/**
 * GLM Provider (Zhipu AI)
 *
 * Integration with GLM LLM API via ChatGLM API.
 * API: https://open.bigmodel.cn/api/paas/v4
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

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4';

export class GLMProvider extends BaseProvider {
  readonly id = 'glm';
  readonly name = 'GLM';
  readonly defaultModel = 'glm-4';
  readonly supportedModels = [
    'glm-4',
    'glm-4-plus',
    'glm-4-flashx',
    'glm-4-flash',
    'glm-4-airx',
    'glm-4-air',
    'glm-4-long',
    'glm-3-turbo',
  ];

  constructor(config: { apiKey?: string } & ProviderConfig = {}) {
    super(config);
    this.config.baseUrl = ZHIPU_API_URL;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const endpoint = `${this.config.baseUrl}/chat/completions`;

    const body = {
      model: request.model,
      messages: this.formatMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stop: request.stop,
      stream: false,
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
    const endpoint = `${this.config.baseUrl}/chat/completions`;

    const body = {
      model: request.model,
      messages: this.formatMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stop: request.stop,
      stream: true,
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
    const endpoint = `${this.config.baseUrl}/embeddings`;

    const body = {
      model: request.model,
      input: request.input,
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

    const choices = ((r.choices as Array<Record<string, unknown>>) || []).map(
      (choice, index) => ({
        index,
        message: {
          role: (choice.message as Record<string, unknown>)?.role as string,
          content: (choice.message as Record<string, unknown>)?.content as string || '',
        },
        finishReason: (choice.finish_reason as string) || 'stop',
      })
    );

    const usage = r.usage as Record<string, number> | undefined;

    return {
      id: (r.id as string) || '',
      model: (r.model as string) || this.defaultModel,
      choices,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0,
          }
        : undefined,
      created: (r.created as number) || Date.now(),
    };
  }

  private parseStreamChunk(chunk: Record<string, unknown>): StreamChunk {
    return {
      id: (chunk.id as string) || '',
      choices: ((chunk.choices as Array<Record<string, unknown>>) || []).map((c) => ({
        index: (c.index as number) || 0,
        delta: {
          content: (c.delta as Record<string, unknown>)?.content as string | undefined,
        },
        finishReason: (c.finish_reason as string | undefined),
      })),
    };
  }

  private parseEmbeddingResponse(response: unknown): EmbeddingResponse {
    const r = response as Record<string, unknown>;
    const data = (r.data as Array<Record<string, unknown>>) || [];

    return {
      model: (r.model as string) || 'embedding-2',
      data: data.map((d, index) => ({
        index,
        embedding: d.embedding as number[],
      })),
      usage: {
        promptTokens: ((r.usage as Record<string, number>)?.total_tokens) || 0,
        completionTokens: 0,
        totalTokens: ((r.usage as Record<string, number>)?.total_tokens) || 0,
      },
    };
  }
}
