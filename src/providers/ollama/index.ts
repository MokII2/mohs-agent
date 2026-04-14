/**
 * Ollama Provider (Local LLM)
 *
 * Integration with local Ollama API.
 * API: http://localhost:11434/api
 */

import { BaseProvider } from '../base/index.js';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  ProviderConfig,
  StreamChunk,
} from '../base/types.js';

const OLLAMA_API_URL = 'http://localhost:11434/api';

export class OllamaProvider extends BaseProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local)';
  readonly defaultModel = 'llama3.2';
  readonly supportedModels: string[] = [];

  constructor(config: { baseUrl?: string } & ProviderConfig = {}) {
    super(config);
    this.config.baseUrl = config.baseUrl || OLLAMA_API_URL;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const endpoint = `${this.config.baseUrl}/chat`;

    const body = {
      model: request.model,
      messages: this.formatMessages(request.messages),
      stream: false,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens,
        top_p: request.topP,
        stop: request.stop,
      },
    };

    const response = await this.request<unknown>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return this.parseResponse(response);
  }

  async chatStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const endpoint = `${this.config.baseUrl}/chat`;

    const body = {
      model: request.model,
      messages: this.formatMessages(request.messages),
      stream: true,
      options: {
        temperature: request.temperature,
        num_predict: request.maxTokens,
        top_p: request.topP,
        stop: request.stop,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          onChunk(this.parseStreamChunk(parsed));
        } catch {
          // Skip
        }
      }
    }
  }

  async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const endpoint = `${this.config.baseUrl}/embeddings`;

    const body = {
      model: request.model,
      prompt: Array.isArray(request.input) ? request.input.join(' ') : request.input,
    };

    const response = await this.request<unknown>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return this.parseEmbeddingResponse(response);
  }

  isAvailable(): boolean {
    return Boolean(this.config.baseUrl);
  }

  protected formatMessages(messages: import('../../types/index.js').Message[]): unknown[] {
    return messages.map((msg) => ({
      role: msg.role === 'tool' ? 'tool' : msg.role,
      content: msg.content,
    }));
  }

  protected parseResponse(response: unknown): ChatCompletionResponse {
    const r = response as Record<string, unknown>;
    const message = r.message as Record<string, unknown> | undefined;

    return {
      id: `ollama-${Date.now()}`,
      model: this.defaultModel,
      choices: [
        {
          index: 0,
          message: {
            role: (message?.role as string) || 'assistant',
            content: (message?.content as string) || '',
          },
          finishReason: (r.done as boolean) ? 'stop' : 'length',
        },
      ],
      usage: r.done
        ? {
            promptTokens: ((r.prompt_eval_count as number) || 0),
            completionTokens: ((r.eval_count as number) || 0),
            totalTokens: ((r.prompt_eval_count as number) || 0) + ((r.eval_count as number) || 0),
          }
        : undefined,
      created: Date.now(),
    };
  }

  private parseStreamChunk(chunk: Record<string, unknown>): StreamChunk {
    const message = chunk.message as Record<string, unknown> | undefined;

    return {
      id: `ollama-${Date.now()}`,
      choices: [
        {
          index: 0,
          delta: {
            role: message?.role as string | undefined,
            content: message?.content as string | undefined,
          },
          finishReason: chunk.done ? 'stop' : undefined,
        },
      ],
    };
  }

  private parseEmbeddingResponse(response: unknown): EmbeddingResponse {
    const r = response as Record<string, unknown>;

    return {
      model: (r.model as string) || this.defaultModel,
      data: [
        {
          index: 0,
          embedding: r.embedding as number[],
        },
      ],
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}
