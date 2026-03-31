# Antigravity AI Calling Agent

A bleeding-edge, fully automated AI calling support agent built with Node.js, Express, WebSocket, Twilio, Deepgram (STT), Anthropic Claude 3 (LLM Engine), and ElevenLabs (TTS).

## Architecture

This project maps the 5-layer architecture specified in the Antigravity Technical Brief:
1. **Telephony Gateway**: Twilio Webhook <-> WebSocket TwiML streaming
2. **Speech-to-Text (STT)**: Deepgram real-time transcription
3. **AI Orchestrator**: Anthropic Claude 3 driving structured JSON action paths (RESOLVE, CONTINUE, TRANSFER)
4. **Text-to-Speech (TTS)**: ElevenLabs mapping to `ulaw_8000` via WebSocket
5. **Reporting**: PostgreSQL query tracking resolving into CRM integration paths.

## Setup & Running Locally

1. Copy `.env.example` to `.env` and fill out your vendor API keys for Twilio, Deepgram, Anthropic, and ElevenLabs.

```bash
cp .env.example .env
```

2. Run the main server in development mode:

```bash
npm run dev
```

3. (Optional) In another terminal, run the React Ops Dashboard:
```bash
cd ops-dashboard
npm run dev
```

4. Expose the server to Twilio (e.g., using `ngrok`):
```bash
ngrok http 3000 --domain=your-custom-ngrok-domain.app
```
And wire Twilio's incoming webhook to `https://your-custom-ngrok-domain.app/twilio/incoming`.

## Deployment

A `Dockerfile` and `k8s/deployment.yaml` have been provided for production containerization mapping to AWS/GCP Kubernetes endpoints integrating autoscaling behaviors (HPA).
