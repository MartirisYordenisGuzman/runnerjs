import type { AIProviderAdapter, ChatMessage } from '../types';

export class GeminiProvider implements AIProviderAdapter {
  async sendChat(params: { apiKey: string; messages: ChatMessage[]; model?: string }): Promise<string> {
    const contents = params.messages.map(msg => {
      // Gemini uses 'model' for 'assistant'
      const role = msg.role === 'assistant' ? 'model' : 'user';
      return {
        role: role,
        parts: [{ text: msg.content }]
      };
    });

    const modelName = params.model || 'gemini-1.5-pro';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${params.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to connect to Gemini');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}
