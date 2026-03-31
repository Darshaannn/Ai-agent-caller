import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/env';
import EventEmitter from 'events';

export class ClaudeOrchestrator extends EventEmitter {
  private anthropic: Anthropic;
  private messageHistory: any[] = [];
  
  constructor() {
    super();
    this.anthropic = new Anthropic({
      apiKey: config.ANTHROPIC_API_KEY,
    });
  }

  public async handleUtterance(transcript: string, systemPrompt: string) {
    this.messageHistory.push({ role: 'user', content: transcript });
    
    try {
      const stream = await this.anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        temperature: 0.2,
        system: systemPrompt,
        messages: this.messageHistory,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullResponse += chunk.delta.text;
        }
      }
      
      this.messageHistory.push({ role: 'assistant', content: fullResponse });
      
      try {
        const jsonResponse = JSON.parse(fullResponse);
        this.emit('response', jsonResponse);
      } catch (parseError) {
        console.error('[Claude] Failed to parse JSON response:', fullResponse);
        this.emit('response', {
          speech: "I'm sorry, I encountered a brief error. Could you repeat what you just said?",
          action: "CONTINUE"
        });
      }
    } catch (err) {
      console.error('[Claude] API Error:', err);
    }
  }
}
