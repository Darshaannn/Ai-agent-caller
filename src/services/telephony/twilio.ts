import { Request, Response, Router } from 'express';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

export const twilioRouter = Router();

// Webhook for incoming Twilio calls
twilioRouter.post('/incoming', (req: Request, res: Response) => {
  const callSid = req.body?.CallSid || 'unknown';
  const caller = req.body?.From || 'unknown';
  console.log(`[Telephony] Incoming call from ${caller}, SID: ${callSid}`);

  const twiml = new VoiceResponse();

  // Set up bidirectional media stream
  const connect = twiml.connect();
  const host = req.headers.host;

  // Connect to the WebSocket endpoint served by our application
  connect.stream({ url: `wss://${host}/media` });

  res.type('text/xml');
  res.send(twiml.toString());
});
