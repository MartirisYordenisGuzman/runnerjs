import type { AIProviderAdapter, ChatMessage } from '../types';

export class MistralProvider implements AIProviderAdapter {
  private readonly endpoint = 'https://api.mistral.ai/v1/chat/completions';

  async sendChat(params: { apiKey: string; messages: ChatMessage[]; model?: string }): Promise<string> {
    const model = params.model || 'open-mixtral-8x7b';
    
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${params.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: params.messages.map(m => ({
            role: m.role,
            content: m.content
          })),
        }),
      });

      if (!response.ok) {
        let errorDetail = '';
        try {
          const errorData = await response.json();
          errorDetail = JSON.stringify(errorData);
        } catch {
          errorDetail = await response.text();
        }
        
        throw new Error(`Mistral API error ${response.status}: ${errorDetail || response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Mistral response invalid: missing choices or message content');
      }

      return data.choices[0].message.content;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Mistral request timed out');
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Mistral network failure: ' + error.message);
      }
      throw error;
    }
  }
}
