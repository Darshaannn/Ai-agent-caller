import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

async function testGemini() {
    console.log('--- Gemini SDK Diagnostic ---');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

    try {
        console.log('Attempting to list models... (This might fail if the key is restricted)');
        // Note: The GenAI SDK doesn't have a direct listModels, we just try to generate a tiny response.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Say 'System Online'");
        const response = result.response.text();
        console.log(`✅ Success! Gemini said: ${response}`);
    } catch (e: any) {
        console.error(`❌ Model Check Failed!`);
        console.error(`Error: ${e.message}`);

        console.log('\nTrying fallback model: gemini-1.5-pro...');
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
            const result = await model.generateContent("Say 'Pro Online'");
            const response = result.response.text();
            console.log(`✅ Success with Pro!`);
        } catch (e2: any) {
            console.error(`❌ Pro fallback also failed: ${e2.message}`);
        }
    }
}

testGemini();
