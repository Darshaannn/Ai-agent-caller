import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from '../../config/env';
import EventEmitter from 'events';

export class GeminiOrchestrator extends EventEmitter {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private chat: any;

    constructor() {
        super();
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        this.model = this.genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            }
        });
    }

    private async getModel(modelName: string) {
        return this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
        });
    }

    public async handleUtterance(transcript: string, systemPrompt: string) {
        const potentialModels = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash-8b"];
        let modelIndex = 0;

        while (modelIndex < potentialModels.length) {
            try {
                // Start a new chat if not already started, including the system prompt
                if (!this.chat) {
                    this.chat = this.model.startChat({
                        history: [
                            {
                                role: "user",
                                parts: [{ text: systemPrompt + "\n\nInitial context: Conversation start. Always respond in valid JSON." }],
                            },
                            {
                                role: "model",
                                parts: [{ text: JSON.stringify({ speech: "Hello! How can I help you today?", action: "CONTINUE" }) }],
                            }
                        ]
                    });
                }

                const result = await this.chat.sendMessage(transcript);
                const fullResponse = result.response.text();

                try {
                    const jsonResponse = JSON.parse(fullResponse);
                    this.emit('response', jsonResponse);
                    return; // Success!
                } catch (parseError) {
                    console.error('[Gemini] Failed to parse JSON response:', fullResponse);
                    this.emit('response', {
                        speech: "I'm sorry, I encountered a brief error. Could you repeat that?",
                        action: "CONTINUE"
                    });
                    return;
                }
            } catch (err: any) {
                if (err.message.includes('404') && modelIndex < potentialModels.length - 1) {
                    modelIndex++;
                    console.warn(`[Gemini] Model 404. Trying next model: ${potentialModels[modelIndex]}`);
                    this.model = await this.getModel(potentialModels[modelIndex]);
                    this.chat = null; // Reset chat for new model
                    continue;
                }
                console.error('[Gemini] API Error:', err.message);
                break;
            }
        }
    }
}
