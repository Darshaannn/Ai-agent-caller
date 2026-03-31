import twilio from 'twilio';
import { config } from '../../config/env';

const client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);

export class EscalationService {
  public async transferToAgent(callSid: string, summary: string) {
    try {
      console.log(`[Escalation] Transferring call ${callSid} to human agent...`);
      
      // Twilio API to update the live call and route it to a human conference/queue
      await client.calls(callSid).update({
        twiml: `<Response><Say>Let me connect you with a specialist. They will have all your context.</Say><Dial><Number>+1234567890</Number></Dial></Response>`
      });
      // Note: A real implementation uses Twilio TaskRouter or Conference API here.
      
      // Dispatch summary to Ops Dashboard
      console.log(`[Ops] Pushed summary to dashboard: ${summary}`);
      return true;
    } catch (err) {
      console.error('[Escalation] Failed to transfer call:', err);
      return false;
    }
  }
}
