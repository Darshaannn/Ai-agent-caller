import express from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { createClient } from 'redis';
import { config } from './config/env';
import { twilioRouter } from './services/telephony/twilio';
import { DeepgramSTT } from './services/stt/deepgram';
import { GroqOrchestrator } from './services/ai/groq';
import { ElevenLabsTTS } from './services/tts/elevenlabs';
import { initDb } from './database/postgres';
import { PromptBuilder } from './prompts/builder';
import { HubSpotCRM as CRMService } from './services/crm/hubspot';
import { EscalationService } from './services/escalation/transfer';
import { ReportingService } from './services/reporting';

// Prevent process exits on unexpected errors
process.on('uncaughtException', (err) => console.error('[Fatal] Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('[Fatal] Unhandled Rejection:', reason));

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use('/twilio', twilioRouter);

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
const opsWss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrades manually for better tunnel stability
server.on('upgrade', (request, socket, head) => {
  const host = request.headers.host || '';
  const url = new URL(request.url || '', `http://${host}`);

  if (url.pathname === '/media') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (url.pathname === '/ops') {
    opsWss.handleUpgrade(request, socket, head, (ws) => {
      opsWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const redisPub = createClient({ url: config.REDIS_URL, socket: { reconnectStrategy: false } });
const redisSub = createClient({ url: config.REDIS_URL, socket: { reconnectStrategy: false } });

let redisWarned = false;
redisPub.on('error', err => {
  if (!redisWarned) { console.warn('[Redis] Not running locally. Features using it will gracefully bypass.'); redisWarned = true; }
});
redisSub.on('error', () => { });

redisPub.connect().catch(() => { });
redisSub.connect().then(() => {
  redisSub.subscribe('call_updates', (message) => {
    opsWss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });
  });
}).catch(() => {
  if (!redisWarned) {
    console.warn('[Redis Subscriber] Not running locally. Real-time updates will bypass.');
    redisWarned = true;
  }
});

const crmService = new CRMService();
const escalationService = new EscalationService();
const reportingService = new ReportingService();

initDb();

wss.on('connection', async (ws: WebSocket) => {
  let callSid = '';
  let streamSid = '';
  let callerContext = {};
  let silenceTimer: NodeJS.Timeout;
  const startTime = Date.now();
  const transcriptLog: any[] = [];
  const mockMode = process.env.MOCK_SERVICES === 'true';
  console.log(`[Twilio WS] Connection established. Mock Mode: ${mockMode}`);

  const stt = new DeepgramSTT();
  const ai = new GroqOrchestrator();
  const tts = new ElevenLabsTTS();

  const resetSilenceTimer = () => {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      console.log('[Timeout] 10s silence detected');
      if (!mockMode) {
        tts.streamText("Are you still there?");
      } else {
        console.log('[Mock] Would play: Are you still there?');
      }
    }, 10000);
  };

  if (!mockMode) {
    stt.start();
    tts.connect();

    tts.on('ready', () => {
      console.log('[TTS] Session Ready. Starting heartbeat...');
      // Heartbeat to prevent 20s timeout (ElevenLabs 1008)
      const heartbeat = setInterval(() => {
        if (tts.readyState === WebSocket.OPEN) {
          tts.streamText(" "); // Just a space to keep it alive
        } else {
          clearInterval(heartbeat);
        }
      }, 15000);

      console.log('[TTS] Sending welcome message...');
      tts.streamText("Namaste! This is Aravind from Heritage Homes. How can I help you with your property search today?");
    });
  } else {
    console.log('[Mock] Services bypassed.');
  }

  stt.on('transcript', async (data) => {
    if (mockMode) return;
    resetSilenceTimer();

    // Only call AI on final transcripts to save tokens and prevent rate limiting
    if (data.isFinal) {
      console.log(`[STT Caller] Final: ${data.transcript}`);
      transcriptLog.push({ speaker: 'caller', text: data.transcript, time: new Date().toISOString() });

      const systemPrompt = PromptBuilder.buildSystemPrompt(callerContext);
      await ai.handleUtterance(data.transcript, systemPrompt);
    } else {
      console.log(`[STT Caller] Interim: ${data.transcript}`);
    }
  });

  ai.on('response', async (response) => {
    resetSilenceTimer();
    console.log(`[AI Response]: ${response.speech} | Action: ${response.action}`);
    transcriptLog.push({ speaker: 'agent', text: response.speech, time: new Date().toISOString() });

    if (!mockMode) {
      console.log(`[TTS] Streaming response: "${response.speech.substring(0, 30)}..."`);
      tts.streamText(response.speech);
    }

    if (response.action === 'TRANSFER') {
      clearTimeout(silenceTimer);
      await escalationService.transferToAgent(callSid, response.reason || 'Requested human assistance');
      stt.stop();
      tts.close();
      await reportingService.generatePostCallReport({ callSid, startTime, intent: response.slots_updated?.intent, status: 'TRANSFERRED', transcript: transcriptLog });
      if (redisPub.isOpen) redisPub.publish('call_updates', JSON.stringify({ type: 'CALL_UPDATE', call: { id: callSid, status: 'TRANSFERRED', duration_sec: Math.round((Date.now() - startTime) / 1000) } }));
    } else if (response.action === 'RESOLVE') {
      clearTimeout(silenceTimer);
      stt.stop();
      tts.close();
      await reportingService.generatePostCallReport({ callSid, startTime, intent: response.slots_updated?.intent, status: 'RESOLVED', transcript: transcriptLog });
      if (redisPub.isOpen) redisPub.publish('call_updates', JSON.stringify({ type: 'CALL_UPDATE', call: { id: callSid, status: 'RESOLVED', duration_sec: Math.round((Date.now() - startTime) / 1000) } }));
    }
  });

  tts.on('audio', (audioBase64) => {
    if (streamSid) {
      console.log(`[Twilio] Sending audio packet (${audioBase64.length} bytes) to stream ${streamSid}`);
      ws.send(JSON.stringify({ event: 'media', streamSid: streamSid, media: { payload: audioBase64 } }));
    } else {
      console.log('[Twilio] Warning: No StreamSid found for audio packet');
    }
  });

  ws.on('message', async (message: string) => {
    try {
      const msg = JSON.parse(message);
      console.log(`[Twilio WS] Event: ${msg.event}`);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        console.log(`[Twilio] Call Started: ${callSid} | Stream: ${streamSid}`);
        callerContext = await crmService.getCallerContext(msg.start.customParameters?.caller || 'Unknown');
        resetSilenceTimer();

        if (redisPub.isOpen) redisPub.publish('call_updates', JSON.stringify({ type: 'CALL_UPDATE', call: { id: callSid, status: 'IN_PROGRESS', duration_sec: 0 } }));
      } else if (msg.event === 'media') {
        stt.pushAudio(msg.media.payload);
      } else if (msg.event === 'stop') {
        console.log(`[Twilio] Call Stopped: ${callSid}`);
        clearTimeout(silenceTimer);
        stt.stop();
        tts.close();
        await reportingService.generatePostCallReport({ callSid, startTime, intent: 'unknown', status: 'DROPPED', transcript: transcriptLog });
        if (redisPub.isOpen) redisPub.publish('call_updates', JSON.stringify({ type: 'CALL_UPDATE', call: { id: callSid, status: 'DROPPED', duration_sec: Math.round((Date.now() - startTime) / 1000) } }));
      }
    } catch (e) {
      console.error('[WebSocket Error] Crash inside message handler:', e);
    }
  });

  ws.on('error', (err) => {
    console.error('[Twilio WS] Error:', err);
  });

  ws.on('close', (code, reason) => {
    console.log(`[Twilio WS] Closed | Code: ${code} | Reason: ${reason}`);
    clearTimeout(silenceTimer);
    stt.stop();
    tts.close();
  });
});

server.listen(config.PORT, () => {
  console.log(`[Server] AI Calling Agent running on port ${config.PORT}`);
});
