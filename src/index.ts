import express from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { createClient } from 'redis';
import { config } from './config/env';
import { twilioRouter } from './services/telephony/twilio';
import { DeepgramSTT } from './services/stt/deepgram';
import { ClaudeOrchestrator } from './services/ai/claude';
import { ElevenLabsTTS } from './services/tts/elevenlabs';
import { initDb } from './database/postgres';
import { PromptBuilder } from './prompts/builder';
import { HubSpotCRM as CRMService } from './services/crm/hubspot';
import { EscalationService } from './services/escalation/transfer';
import { ReportingService } from './services/reporting';

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use('/twilio', twilioRouter);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/media' });
const opsWss = new WebSocketServer({ server, path: '/ops' });

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
}).catch(console.error);

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

  const stt = new DeepgramSTT();
  const ai = new ClaudeOrchestrator();
  const tts = new ElevenLabsTTS();

  const resetSilenceTimer = () => {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      console.log('[Timeout] 10s silence detected');
      tts.streamText("Are you still there?");
      tts.finish();
    }, 10000);
  };

  stt.start();
  tts.connect();

  stt.on('transcript', async (data) => {
    resetSilenceTimer();
    console.log(`[STT Caller]: ${data.transcript}`);
    transcriptLog.push({ speaker: 'caller', text: data.transcript, time: new Date().toISOString() });

    const systemPrompt = PromptBuilder.buildSystemPrompt(callerContext);
    await ai.handleUtterance(data.transcript, systemPrompt);
  });

  ai.on('response', async (response) => {
    resetSilenceTimer();
    console.log(`[AI Response]: ${response.speech} | Action: ${response.action}`);
    transcriptLog.push({ speaker: 'agent', text: response.speech, time: new Date().toISOString() });

    tts.streamText(response.speech);
    tts.finish();

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
      ws.send(JSON.stringify({ event: 'media', streamSid: streamSid, media: { payload: audioBase64 } }));
    }
  });

  ws.on('message', async (message: string) => {
    try {
      const msg = JSON.parse(message);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        callerContext = await crmService.getCallerContext(msg.start.customParameters?.caller || 'Unknown');
        resetSilenceTimer();

        if (redisPub.isOpen) redisPub.publish('call_updates', JSON.stringify({ type: 'CALL_UPDATE', call: { id: callSid, status: 'IN_PROGRESS', duration_sec: 0 } }));
        console.log(`[Twilio] Call Started: ${callSid}`);
      } else if (msg.event === 'media') {
        stt.pushAudio(msg.media.payload);
      } else if (msg.event === 'stop') {
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

  ws.on('close', () => {
    clearTimeout(silenceTimer);
    stt.stop();
    tts.close();
  });
});

server.listen(config.PORT, () => {
  console.log(`[Server] AI Calling Agent running on port ${config.PORT}`);
});
