export type AIProvider = 'openai' | 'gemini' | 'anthropic' | 'deepseek' | 'mistral';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AIContext = {
  currentCode: string;
  consoleOutput?: string;
  runtimeError?: string;
  openFiles?: { name: string; content: string }[];
};

export type AIRequest = {
  provider: AIProvider;
  apiKey: string;
  messages: ChatMessage[];
  context: AIContext;
  model?: string;
};

export interface ProviderResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface AIProviderAdapter {
  sendChat(params: {
    apiKey: string;
    messages: ChatMessage[];
    model?: string;
  }): Promise<string>;
}
