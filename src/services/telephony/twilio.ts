import { Request, Response, Router } from 'express';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';

export const twilioRouter = Router();

// Webhook for incoming Twilio calls
twilioRouter.post('/incoming', (req: Request, res: Response) => {
  try {
    const callSid = req.body?.CallSid || 'unknown';
    const caller = req.body?.From || 'unknown';
    console.log(`[Telephony] Incoming call from ${caller}, SID: ${callSid}`);

    const twiml = new VoiceResponse();

    // Set up bidirectional media stream
    const connect = twiml.connect();
    const host = req.headers.host;

    // Connect to the WebSocket endpoint served by our application
    // Use wss for production tunnels (lhr.life/ngrok) and ws for local
    const protocol = (req.query.local === 'true') ? 'ws' : 'wss';
    connect.stream({ url: `${protocol}://${host}/media` });

    res.set('Content-Type', 'text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('[Telephony] Error generating TwiML:', error);
    res.status(500).send('Error generating TwiML');
  }
});
