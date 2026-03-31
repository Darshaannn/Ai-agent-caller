import { config } from '../../config/env';

export class HubSpotCRM {
  private apiKey: string;

  constructor() {
    // Expecting HUBSPOT_API_KEY in .env in a production scenario
    this.apiKey = process.env.HUBSPOT_API_KEY || '';
  }

  public async getCallerContext(phoneNumber: string) {
    if (!this.apiKey) {
      console.log(`[HubSpot Mock] Fetching context for ${phoneNumber}`);
      return { name: 'VIP Guest', account_status: 'active', vip_flag: true, recent_tickets: [] };
    }

    try {
      console.log(`[HubSpot] Fetching contact by phone: ${phoneNumber}`);
      const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: 'phone', operator: 'EQ', value: phoneNumber }] }],
          properties: ['firstname', 'lastname', 'lifecyclestage', 'hs_lead_status']
        })
      });

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const contact = data.results[0].properties;
        return {
          name: `${contact.firstname} ${contact.lastname}`,
          account_status: contact.lifecyclestage,
          vip_flag: contact.hs_lead_status === 'CUSTOMER',
          recent_tickets: []
        };
      }
    } catch (err) {
      console.error('[HubSpot] Error fetching caller context:', err);
    }
    
    // Fallback if not found
    return { name: 'Unknown Caller', account_status: 'prospect', vip_flag: false, recent_tickets: [] };
  }

  public async logInteraction(callId: string, intent: string, resolution: string) {
    if (!this.apiKey) return true;
    
    try {
      // Ideally, we search the contact ID first and log an Engagement (Call) object.
      console.log(`[HubSpot] Logging call ${callId} with intent: ${intent}`);
      // Implementation of Engagement API goes here
      return true;
    } catch (err) {
      console.error('[HubSpot] Error logging call:', err);
      return false;
    }
  }
}
