import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function makeTestCall() {
    try {
        const call = await client.calls.create({
            url: 'https://51760ff1c78333.lhr.life/twilio/incoming',
            to: '+917400274288', // REPLACE THIS with your Verified Indian Phone Number
            from: '+12602702197'
        });
        console.log('✅ Success! Twilio is now calling your phone.');
        console.log('Call SID:', call.sid);
        console.log('Pick up the phone and press 1 when prompted!');
    } catch (error) {
        console.error('❌ Failed to initiate call:', error);
    }
}

makeTestCall();
