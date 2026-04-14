/**
 * Base Provider Abstract Class
 *
 * Provides common functionality for all LLM providers.
 */

import type {
  LLMProvider,
  ProviderConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  StreamChunk,
} from './types.js';

export abstract class BaseProvider implements LLMProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly defaultModel: string;
  abstract readonly supportedModels: string[];

  protected config: ProviderConfig;

  constructor(config: ProviderConfig = {}) {
    this.config = {
      timeout: 60000,
      maxRetries: 3,
      ...config,
    };
  }

  abstract chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  abstract chatStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;
  abstract embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  abstract isAvailable(): boolean;

  /**
   * Format messages to provider-specific format
   */
  protected abstract formatMessages(
    messages: import('../../types/index.js').Message[]
  ): unknown[];

  /**
   * Parse provider response to standard format
   */
  protected abstract parseResponse(response: unknown): ChatCompletionResponse;

  /**
   * Make HTTP request with retry logic
   */
  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { timeout, maxRetries } = this.config;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < (maxRetries ?? 3); attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(endpoint, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...this.getHeaders(),
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`HTTP ${response.status}: ${error}`);
        }

        return response.json() as Promise<T>;
      } catch (error) {
        lastError = error as Error;
        if (attempt < (maxRetries ?? 3) - 1) {
          await this.delay(Math.pow(2, attempt) * 100);
        }
      }
    }

    throw lastError ?? new Error('Request failed');
  }

  /**
   * Get provider-specific headers
   */
  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
