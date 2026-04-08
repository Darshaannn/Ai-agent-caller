import twilio from 'twilio';
import { createClient } from '@deepgram/sdk';
import Anthropic from '@anthropic-ai/sdk';
import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

async function checkKeys() {
    console.log('--- API Key Diagnostics ---');

    // 1. Twilio
    try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const account = await client.api.v2010.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
        console.log(`✅ Twilio: Working (Account: ${account.friendlyName})`);
    } catch (e: any) {
        console.error(`❌ Twilio: Failed (${e.message})`);
    }

    // 2. Deepgram
    try {
        const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');
        const { result, error } = await deepgram.manage.getProjects();
        if (error) throw error;
        console.log(`✅ Deepgram: Working (${result?.projects?.length} projects found)`);
    } catch (e: any) {
        console.error(`❌ Deepgram: Failed (${e.message})`);
    }

    // 3. Anthropic
    try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
        await anthropic.models.list();
        console.log(`✅ Anthropic: Working`);
    } catch (e: any) {
        console.error(`❌ Anthropic: Failed (${e.message})`);
    }

    // 4. ElevenLabs (Voice ID check via Voice API)
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/voices/${process.env.ELEVENLABS_VOICE_ID}`, {
            headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || '' }
        });
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ ElevenLabs: Working (Voice: ${data.name})`);
        } else {
            console.error(`❌ ElevenLabs: Failed (Status: ${response.status})`);
        }
    } catch (e: any) {
        console.error(`❌ ElevenLabs: Failed (${e.message})`);
    }
}

checkKeys();
