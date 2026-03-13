import type { AIRequest, ProviderResponse, AIProviderAdapter } from './types';
import { ContextBuilder } from './ContextBuilder';
import { OpenAIProvider } from './providers/openai';
import { GeminiProvider } from './providers/gemini';
import { AnthropicProvider } from './providers/anthropic';
import { DeepSeekProvider } from './providers/deepseek';
import { MistralProvider } from './providers/mistral';

export class AIService {
  private static providers: Record<string, AIProviderAdapter> = {
    openai: new OpenAIProvider(),
    gemini: new GeminiProvider(),
    anthropic: new AnthropicProvider(),
    deepseek: new DeepSeekProvider(),
    mistral: new MistralProvider(),
  };

  static async handleRequest(request: AIRequest): Promise<ProviderResponse> {
    try {
      if (!request.apiKey) {
        return { success: false, error: 'API key is required' };
      }

      const rawProvider = (request.provider || '').toLowerCase().trim();
      console.debug("AI Request:", { ...request, apiKey: '***' });

      // Model-to-provider fallback for Mistral
      const mistralModels = ["mixtral", "mistral-small", "mistral-medium", "mistral-large", "open-mixtral"];
      const isMistralModel = mistralModels.some(model => (request.model || '').toLowerCase().includes(model));
      
      const provider = (isMistralModel || rawProvider === 'mistral') ? 'mistral' : rawProvider;
      console.debug("AIService normalized provider:", provider);

      const adapter = this.providers[provider];
      if (!adapter) {
        throw new Error(`Invalid provider: ${request.provider}`);
      }

      const systemMessages = ContextBuilder.buildSystemPrompt(request.context);
      const fullMessages = [
        ...systemMessages,
        ...request.messages
      ];

      const response = await adapter.sendChat({
        apiKey: request.apiKey,
        messages: fullMessages,
        model: request.model,
      });

      return {
        success: true,
        message: response,
      };
    } catch (error: unknown) {
      console.error(`AIService Error [${request.provider}]:`, error);
      
      let errorMessage = 'An unexpected error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Safeguard: Never log the API key in error messages (it shouldn't be there anyway from our logic)
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
