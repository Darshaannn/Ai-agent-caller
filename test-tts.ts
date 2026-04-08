import WebSocket from 'ws';
import * as dotenv from 'dotenv';
dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'CwhRBWXzGAHq8TQ4Fs17';

if (!ELEVENLABS_API_KEY) {
    console.error('❌ Missing ELEVENLABS_API_KEY in .env');
    process.exit(1);
}

const url = `wss://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream-input?model_id=eleven_multilingual_v2&output_format=ulaw_8000`;
console.log('🔗 Connecting to ElevenLabs with Header Auth...');

const ws = new WebSocket(url, {
    headers: {
        'xi-api-key': ELEVENLABS_API_KEY
    }
});

ws.on('open', () => {
    console.log('✅ Connected to ElevenLabs WebSocket');

    // Turn 1
    console.log('📤 Sending Turn 1...');
    ws.send(JSON.stringify({
        text: "This is the first turn. I am Heritage Homes.",
        try_trigger_generation: true
    }));

    // Wait and send Turn 2
    setTimeout(() => {
        console.log('📤 Sending Turn 2...');
        ws.send(JSON.stringify({
            text: "This is the second turn. Multi-turn test active.",
            try_trigger_generation: true
        }));
    }, 4000);
});

ws.on('message', (data) => {
    const response = JSON.parse(data.toString());
    if (response.audio) {
        console.log(`📥 Received chunks: ${response.audio.length} bytes`);
    }
});

ws.on('error', (err) => {
    console.error('❌ ElevenLabs Error:', err.message);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed. Code: ${code}, Reason: ${reason}`);
});

setTimeout(() => {
    console.log('⏱️ Test timed out after 10s');
    ws.close();
    process.exit(0);
}, 10000);
