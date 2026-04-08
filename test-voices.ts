import dotenv from 'dotenv';
dotenv.config();

async function listVoices() {
    console.log('--- ElevenLabs Simple Key Test ---');
    const apiKey = process.env.ELEVENLABS_API_KEY || '';

    try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': apiKey }
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ Success! Your key is VALID.`);
            console.log(`Available voices: ${data.voices.length}`);
            console.log(`All voices:`, data.voices.map((v: any) => `${v.name} (${v.voice_id})`));
        } else {
            console.error(`❌ Key Check Failed! Status: ${response.status}`);
            const text = await response.text();
            console.error(`Error details: ${text}`);
        }
    } catch (e: any) {
        console.error(`❌ Network error: ${e.message}`);
    }
}

listVoices();
