import Groq from "groq-sdk";
import { config } from '../../config/env';
import EventEmitter from 'events';

export class GroqOrchestrator extends EventEmitter {
    private groq: Groq;
    private messageHistory: any[] = [];

    constructor() {
        super();
        this.groq = new Groq({
            apiKey: process.env.GROQ_API_KEY || '',
        });
    }

    public async handleUtterance(transcript: string, systemPrompt: string) {
        this.messageHistory.push({ role: 'user', content: transcript });

        try {
            const completion = await this.groq.chat.completions.create({
                messages: [
                    { role: "system", content: systemPrompt },
                    ...this.messageHistory
                ],
                model: "llama-3.1-8b-instant",
                temperature: 0.5,
                max_tokens: 500,
                response_format: { type: "json_object" }
            });

            const fullResponse = completion.choices[0]?.message?.content || "";

            this.messageHistory.push({ role: 'assistant', content: fullResponse });

            try {
                const jsonResponse = JSON.parse(fullResponse);
                this.emit('response', jsonResponse);
            } catch (parseError) {
                console.error('[Groq] Failed to parse JSON response:', fullResponse);
                this.emit('response', {
                    speech: "I'm sorry, I had a bit of a hiccup. Can you say that again?",
                    action: "CONTINUE"
                });
            }
        } catch (err: any) {
            console.error('[Groq] API Error:', err.message);
            if (err.message.includes('API key')) {
                this.emit('response', {
                    speech: "I'm sorry, my AI key is not valid. Please check your Groq key.",
                    action: "CONTINUE"
                });
            }
        }
    }
}
