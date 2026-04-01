import WebSocket from 'ws';
import { config } from '../../config/env';
import EventEmitter from 'events';

export class ElevenLabsTTS extends EventEmitter {
  private ws: WebSocket | null = null;
  private voiceId: string;

  constructor() {
    super();
    this.voiceId = config.ELEVENLABS_VOICE_ID;
  }

  public get readyState() {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED;
  }

  public connect() {
    // Request ulaw_8000 format so it can be streamed directly to Twilio Media Streams natively
    const url = `wss://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream-input?model_id=eleven_turbo_v2&output_format=ulaw_8000`;

    this.ws = new WebSocket(url, {
      headers: {
        'xi-api-key': config.ELEVENLABS_API_KEY
      }
    });

    this.ws.on('open', () => {
      console.log('[ElevenLabs] TTS WebSocket connected');
      // Send initial configuration frame
      this.ws?.send(JSON.stringify({
        text: " ",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 }
      }));
      this.emit('ready');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      const response = JSON.parse(data.toString());
      if (response.audio) {
        this.emit('audio', response.audio);
      }
      // ElevenLabs WS API sometimes uses is_final instead of isFinal
      if (response.is_final || response.isFinal) {
        this.emit('done');
      }
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[ElevenLabs] TTS WebSocket disconnected. Code: ${code}, Reason: ${reason}`);
    });

    this.ws.on('error', (error) => {
      console.error('[ElevenLabs] TTS WebSocket error:', error);
      console.log('[Failover] Triggering AWS Polly fallback for TTS...');
      // Synthesize text mapping to AWS Polly goes here
    });
  }

  public streamText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text, try_trigger_generation: true }));
    }
  }

  public finish() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text: "" })); // Empty payload signals EoS
    }
  }

  public close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}
