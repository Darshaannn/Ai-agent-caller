const { spawn } = require('child_process');
const fs = require('fs');
const twilio = require('twilio');
require('dotenv').config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
console.log('Starting localhost.run tunnel...');
const tunnel = spawn('ssh', ['-R', '80:localhost:3000', 'ssh.localhost.run', '-o', 'StrictHostKeyChecking=no']);

global.called = false;

tunnel.stdout.on('data', async (data) => {
    const str = data.toString();
    console.log(str);
    const match = str.match(/https:\/\/[a-z0-9-]+\.lhr\.life/);
    if (match && !global.called) {
        global.called = true;
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

            console.log('Placing call to user...');
            const call = await client.calls.create({
                url: url + '/twilio/incoming',
                to: '+917400274288',
                from: '+12602702197'
            });
            console.log('SUCCESS! Call SID:', call.sid);
            console.log('KEEPING TUNNEL ALIVE... DO NOT CLOSE');
        } catch (e) {
            console.error(e);
        }
    }
});
tunnel.stderr.on('data', d => {
    const e = d.toString();
    console.error(e);
    if (e.includes('Permission denied')) {
        console.log('SSH Key missing or permission denied.');
    }
});
