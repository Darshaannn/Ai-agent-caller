const { exec } = require('child_process');
const fs = require('fs');
const twilio = require('twilio');
require('dotenv').config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
console.log('Starting Cloudflare tunnel...');
const tunnel = exec('npx untun@latest tunnel http://127.0.0.1:3000');

tunnel.stdout.on('data', async (data) => {
    const match = data.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match) {
        const url = match[0];
        console.log('Tunnel obtained:', url);
        try {
            let phoneNumbers = await client.incomingPhoneNumbers.list({ limit: 1 });
            if (phoneNumbers.length > 0) {
                await client.incomingPhoneNumbers(phoneNumbers[0].sid).update({ voiceUrl: url + '/twilio/incoming' });
                console.log('Twilio Webhook Updated!');
            }
            const scriptPath = 'test-call.ts';
            let script = fs.readFileSync(scriptPath, 'utf8');
            script = script.replace(/url: '.*'/, `url: '${url}/twilio/incoming'`);
            fs.writeFileSync(scriptPath, script);
            console.log('Script patched!');

            console.log('Placing call to user...');
            const call = await client.calls.create({
                url: url + '/twilio/incoming',
                to: '+917400274288',
                from: '+12602702197'
            });
            console.log('SUCCESS! Call SID:', call.sid);
            process.exit(0);
        } catch (e) {
            console.error(e);
            process.exit(1);
        }
    }
});
