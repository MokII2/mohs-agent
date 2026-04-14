/**
 * Qwen Provider (Alibaba Cloud)
 *
 * Integration with Qwen LLM API via DashScope or OpenAI-compatible endpoint.
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

const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1';

export class QwenProvider extends BaseProvider {
  readonly id = 'qwen';
  readonly name = 'Qwen';
  readonly defaultModel = 'qwen-turbo';
  readonly supportedModels = [
    'qwen-turbo',
    'qwen-plus',
    'qwen-max',
    'qwen-max-longcontext',
    'qwen-72b-chat',
    'qwen-14b-chat',
    'qwen-7b-chat',
    'qwen-1.8b-chat',
  ];

  constructor(config: { apiKey?: string; workspace?: string } & ProviderConfig = {}) {
    super(config);
    this.config.baseUrl = DASHSCOPE_API_URL;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const endpoint = `${this.config.baseUrl}/services/aigc/text-generation/generation`;

    const body = {
      model: request.model,
      input: {
        messages: this.formatMessages(request.messages),
      },
      parameters: {
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        stop: request.stop,
        result_format: 'message',
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
    const endpoint = `${this.config.baseUrl}/services/aigc/text-generation/generation`;

    const body = {
      model: request.model,
      input: {
        messages: this.formatMessages(request.messages),
      },
      parameters: {
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        top_p: request.topP,
        stop: request.stop,
        result_format: 'message',
        incremental_output: true,
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
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
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            onChunk(this.parseStreamChunk(parsed));
          } catch {
            // Skip
          }
        }
      }
    }
  }

  async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const endpoint = `${this.config.baseUrl}/services/embeddings/text-embedding/text-embedding`;

    const body = {
      model: request.model,
      input: {
        texts: Array.isArray(request.input) ? request.input : [request.input],
      },
    };

    const response = await this.request<unknown>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return this.parseEmbeddingResponse(response);
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey);
  }

  protected formatMessages(messages: import('../../types/index.js').Message[]): unknown[] {
    return messages.map((msg) => ({
      role: msg.role === 'tool' ? 'function' : msg.role,
      name: msg.toolResultId,
      content: msg.content,
    }));
  }

  protected parseResponse(response: unknown): ChatCompletionResponse {
    const r = response as Record<string, unknown>;
    const output = r.output as Record<string, unknown>;
    const choices = (output?.choices as Array<Record<string, unknown>>) || [];

    return {
      id: (r.request_id as string) || '',
      model: (r.model as string) || this.defaultModel,
      choices: choices.map((choice, index) => ({
        index,
        message: {
          role: (choice.message as Record<string, unknown>)?.role as string || 'assistant',
          content: (choice.message as Record<string, unknown>)?.content as string || '',
        },
        finishReason: (choice.finish_reason as string) || 'stop',
      })),
      created: Date.now(),
    };
  }

  private parseStreamChunk(chunk: Record<string, unknown>): StreamChunk {
    const output = chunk.output as Record<string, unknown>;
    const choices = (output?.choices as Array<Record<string, unknown>>) || [];

    return {
      id: (chunk.request_id as string) || '',
      choices: choices.map((c, index) => ({
        index,
        delta: {
          content: (c.delta as Record<string, unknown>)?.content as string | undefined,
        },
        finishReason: (c.finish_reason as string | undefined),
      })),
    };
  }

  private parseEmbeddingResponse(response: unknown): EmbeddingResponse {
    const r = response as Record<string, unknown>;
    const output = r.output as Record<string, unknown>;
    const data = (output?.embeddings as Array<{ embedding: number[] }>) || [];

    return {
      model: (r.model as string) || 'text-embedding-v2',
      data: data.map((d, index) => ({
        index,
        embedding: d.embedding,
      })),
      usage: {
        promptTokens: ((r.usage as Record<string, number>)?.input_tokens) || 0,
        completionTokens: 0,
        totalTokens: ((r.usage as Record<string, number>)?.total_tokens) || 0,
      },
    };
  }
}
