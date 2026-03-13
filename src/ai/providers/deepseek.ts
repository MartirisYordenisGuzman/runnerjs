import type { AIProviderAdapter, ChatMessage } from '../types';

export class DeepSeekProvider implements AIProviderAdapter {
  async sendChat(params: { apiKey: string; messages: ChatMessage[]; model?: string }): Promise<string> {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model || 'deepseek-chat',
        messages: params.messages,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to connect to DeepSeek');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}
