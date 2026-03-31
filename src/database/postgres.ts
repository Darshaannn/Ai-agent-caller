import { Pool } from 'pg';
import { config } from '../config/env';

export const pool = new Pool({
  connectionString: config.DATABASE_URL
});

pool.on('error', (err) => {
  console.warn('[PostgreSQL] Connection error (ignoring for local dev):', err.message);
});

export async function initDb() {
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS call_logs (
        call_id VARCHAR(255) PRIMARY KEY,
        caller_id VARCHAR(255),
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        duration_sec INT,
        intent VARCHAR(100),
        status VARCHAR(50),
        transcript JSONB
      );
    `);
    console.log('[PostgreSQL] Database initialized');
    client.release();
  } catch (err) {
    console.warn('[PostgreSQL] Database not running locally, dashboard logging will bypass gracefully.');
  }
}

export async function logCall(callData: any) {
  try {
    await pool.query(
      `INSERT INTO call_logs (call_id, caller_id, intent, status, transcript)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (call_id) DO UPDATE SET 
         intent = $3, status = $4, transcript = $5, duration_sec = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - call_logs.timestamp))`,
      [callData.callSid, callData.caller, callData.intent, callData.status, JSON.stringify(callData.transcript)]
    );
  } catch (err) {
    console.error('[PostgreSQL] Failed to log call:', err);
  }
}
