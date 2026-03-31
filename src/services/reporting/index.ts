import { pool } from '../../database/postgres';
import { CRMService } from '../crm';

const crm = new CRMService();

export class ReportingService {
  public async generatePostCallReport(callData: any) {
    console.log(`[Reporting] Generating post call report for ${callData.callSid}`);
    
    const report = {
      call_id: callData.callSid,
      timestamp: new Date().toISOString(),
      duration_sec: Math.round((Date.now() - callData.startTime) / 1000),
      intent: callData.intent,
      resolution_status: callData.status,
      transcript: callData.transcript,
      sentiment_score: 0.5 // Mock baseline for Phase 2
    };

    // 1. Save JSON to Postgres
    try {
      await pool.query(
        `INSERT INTO call_logs (call_id, caller_id, intent, status, transcript, duration_sec)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (call_id) DO UPDATE SET 
           intent = $3, status = $4, transcript = $5, duration_sec = $6`,
        [report.call_id, 'unknown', report.intent || 'unknown', report.resolution_status, JSON.stringify(report.transcript), report.duration_sec]
      );
    } catch (err) {
      console.error('[Reporting] Failed to save to Postgres:', err);
    }

    // 2. Write back to CRM
    await crm.logInteraction(report.call_id, report.intent, report.resolution_status);

    console.log('[Reporting] Report generated and synchronized successfully.');
    return report;
  }
}
