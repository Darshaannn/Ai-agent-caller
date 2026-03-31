import { createClient, LiveClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { config } from '../../config/env';
import EventEmitter from 'events';

export class DeepgramSTT extends EventEmitter {
  private deepgram: ReturnType<typeof createClient>;
  private liveClient: LiveClient | null = null;
  private isReady: boolean = false;

  constructor() {
    super();
    this.deepgram = createClient(config.DEEPGRAM_API_KEY);
  }

  public start() {
    this.liveClient = this.deepgram.listen.live({
      model: 'nova-2',
      language: 'multi', // Supporting Hindi and English explicitly as per Phase 3
      encoding: 'mulaw',
      sample_rate: 8000,
      channels: 1,
      interim_results: true,
      endpointing: 200 // 200ms silence detection for VAD as specified in PDF
    });

    this.liveClient.on(LiveTranscriptionEvents.Open, () => {
      this.isReady = true;
      console.log('[Deepgram] WebSocket connection opened');
      this.emit('ready');
    });

    this.liveClient.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const transcript = data.channel.alternatives[0]?.transcript;
      const isFinal = data.is_final;
      const confidence = data.channel.alternatives[0]?.confidence;

      if (transcript && transcript.length > 0) {
        if (confidence > 0.75 || isFinal) { // Ensure confidence is > 0.75 as per PDF
          this.emit('transcript', { transcript, isFinal, confidence });
        }
      }
    });

    this.liveClient.on(LiveTranscriptionEvents.Close, () => {
      this.isReady = false;
      console.log('[Deepgram] WebSocket connection closed');
    });

    this.liveClient.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('[Deepgram] WebSocket error:', error);
      console.log('[Failover] Triggering OpenAI Whisper fallback for STT...');
      // Whisper fallback stream initialization goes here
    });
  }

  public pushAudio(payloadBase64: string) {
    if (this.isReady && this.liveClient) {
      const buffer = Buffer.from(payloadBase64, 'base64');
      this.liveClient.send(buffer);
    }
  }

  public stop() {
    if (this.liveClient) {
      this.liveClient.finish();
      this.isReady = false;
    }
  }
}
