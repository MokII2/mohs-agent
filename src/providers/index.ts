/**
 * Provider Registry
 *
 * Central registry for all LLM providers.
 * Manages provider registration, selection, and routing.
 */

import type { LLMProvider, ProviderConfig, ChatCompletionRequest, ChatCompletionResponse } from './base/types.js';
import { BaseProvider } from './base/index.js';
import { MiniMaxProvider } from './minimax/index.js';
import { QwenProvider } from './qwen/index.js';
import { KimiProvider } from './kimi/index.js';
import { GLMProvider } from './glm/index.js';
import { ClaudeProvider } from './claude/index.js';
import { GPTProvider } from './gpt/index.js';
import { GeminiProvider } from './gemini/index.js';
import { OllamaProvider } from './ollama/index.js';
import { DeepSeekProvider } from './deepseek/index.js';

export { BaseProvider };
export type { LLMProvider, ProviderConfig, ChatCompletionRequest, ChatCompletionResponse };
export { MiniMaxProvider, QwenProvider, KimiProvider, GLMProvider, ClaudeProvider, GPTProvider, GeminiProvider, OllamaProvider, DeepSeekProvider };

/**
 * Provider registry
 */
export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProviderId?: string;

  constructor() {
    this.registerDefaults();
  }

  /**
   * Register default providers
   */
  private registerDefaults(): void {
    // MiniMax
    if (process.env.MINIMAX_API_KEY) {
      this.register(new MiniMaxProvider({
        apiKey: process.env.MINIMAX_API_KEY,
        groupId: process.env.MINIMAX_GROUP_ID,
      }), true);
    }

    // Qwen
    if (process.env.DASHSCOPE_API_KEY) {
      this.register(new QwenProvider({
        apiKey: process.env.DASHSCOPE_API_KEY,
      }), true);
    }

    // Kimi
    if (process.env.MOONSHOT_API_KEY) {
      this.register(new KimiProvider({
        apiKey: process.env.MOONSHOT_API_KEY,
      }), true);
    }

    // GLM
    if (process.env.ZHIPU_API_KEY) {
      this.register(new GLMProvider({
        apiKey: process.env.ZHIPU_API_KEY,
      }), true);
    }

    // Claude
    if (process.env.ANTHROPIC_API_KEY) {
      this.register(new ClaudeProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
      }), true);
    }

    // OpenAI GPT
    if (process.env.OPENAI_API_KEY) {
      this.register(new GPTProvider({
        apiKey: process.env.OPENAI_API_KEY,
        organization: process.env.OPENAI_ORG_ID,
      }), true);
    }

    // Gemini
    if (process.env.GOOGLE_API_KEY) {
      this.register(new GeminiProvider({
        apiKey: process.env.GOOGLE_API_KEY,
      }), true);
    }

    // Ollama (local)
    this.register(new OllamaProvider({
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
    }), false);

    // DeepSeek
    if (process.env.DEEPSEEK_API_KEY) {
      this.register(new DeepSeekProvider({
        apiKey: process.env.DEEPSEEK_API_KEY,
      }), true);
    }
  }

  /**
   * Register a provider
   */
  register(provider: LLMProvider, setAsDefault: boolean = false): void {
    this.providers.set(provider.id, provider);

    if (setAsDefault || !this.defaultProviderId) {
      this.defaultProviderId = provider.id;
    }
  }

  /**
   * Unregister a provider
   */
  unregister(providerId: string): boolean {
    if (this.defaultProviderId === providerId) {
      this.defaultProviderId = undefined;
    }
    return this.providers.delete(providerId);
  }

  /**
   * Get provider by ID
   */
  get(providerId: string): LLMProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get default provider
   */
  getDefault(): LLMProvider | undefined {
    if (!this.defaultProviderId) return undefined;
    return this.providers.get(this.defaultProviderId);
  }

  /**
   * Get all registered providers
   */
  getAll(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get available providers (have valid auth)
   */
  getAvailable(): LLMProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.isAvailable());
  }

  /**
   * Get default provider ID
   */
  getDefaultId(): string | undefined {
    return this.defaultProviderId;
  }

  /**
   * Set default provider
   */
  setDefault(providerId: string): boolean {
    if (!this.providers.has(providerId)) return false;
    this.defaultProviderId = providerId;
    return true;
  }

  /**
   * Route request to appropriate provider based on model
   */
  routeByModel(model: string): LLMProvider | undefined {
    // Check model prefix to determine provider
    const prefix = model.split('-')[0].toLowerCase();

    const prefixMap: Record<string, string> = {
      'minimax': 'minimax',
      'qwen': 'qwen',
      'moonshot': 'kimi',
      'kimi': 'kimi',
      'glm': 'glm',
      'claude': 'claude',
      'gpt': 'openai',
      'openai': 'openai',
      'gemini': 'gemini',
      'ollama': 'ollama',
      'llama': 'ollama',
      'deepseek': 'deepseek',
    };

    const providerId = prefixMap[prefix];
    if (providerId) {
      return this.providers.get(providerId);
    }

    // Fall back to default
    return this.getDefault();
  }

  /**
   * Unified chat completion
   */
  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const provider = this.routeByModel(request.model) || this.getDefault();

    if (!provider) {
      throw new Error('No provider available');
    }

    return provider.chat(request);
  }

  /**
   * Get all supported models across all providers
   */
  getAllSupportedModels(): Array<{ providerId: string; providerName: string; models: string[] }> {
    return Array.from(this.providers.values()).map((p) => ({
      providerId: p.id,
      providerName: p.name,
      models: p.supportedModels,
    }));
  }
}

// Export singleton
export const providerRegistry = new ProviderRegistry();
