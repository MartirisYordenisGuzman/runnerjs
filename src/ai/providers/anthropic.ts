import type { AIProviderAdapter, ChatMessage } from '../types';

export class AnthropicProvider implements AIProviderAdapter {
  async sendChat(params: { apiKey: string; messages: ChatMessage[]; model?: string }): Promise<string> {
    const systemMessage = params.messages.find(m => m.role === 'system');
    const chatMessages = params.messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model || 'claude-3-5-sonnet-20240620',
        system: systemMessage?.content,
        messages: chatMessages,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to connect to Anthropic');
    }

    const data = await response.json();
    return data.content[0].text;
  }
}
