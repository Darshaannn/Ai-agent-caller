import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  PORT: process.env.PORT || 3000,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obbfIdV3Q9',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/aicaller'
};

const requiredKeys = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'DEEPGRAM_API_KEY', 'ANTHROPIC_API_KEY', 'ELEVENLABS_API_KEY'];
for (const key of requiredKeys) {
  if (!config[key as keyof typeof config]) {
    console.warn(`WARNING: Missing critical environment variable: ${key}`);
  }
}
