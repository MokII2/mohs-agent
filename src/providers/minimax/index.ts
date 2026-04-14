/**
 * MiniMax Provider
 *
 * Integration with MiniMax LLM API.
 * API: https://api.minimax.chat/v1
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
import type { ToolCall } from '../../types/index.js';

const MINIMAX_API_URL = 'https://api.minimax.chat/v1';

export class MiniMaxProvider extends BaseProvider {
  readonly id = 'minimax';
  readonly name = 'MiniMax';
  readonly defaultModel = 'MiniMax-M2.5';
  readonly supportedModels = [
    'MiniMax-M2.5',
    'MiniMax-M2',
    'MiniMax-M1.5',
    'MiniMax-Text-01',
  ];

  constructor(config: { apiKey?: string; groupId?: string } & ProviderConfig = {}) {
    super(config);
    this.config.baseUrl = MINIMAX_API_URL;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const endpoint = `${this.config.baseUrl}/chat_completions?GroupId=${process.env.MINIMAX_GROUP_ID}`;

    const body = {
      model: request.model,
      messages: this.formatMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stop: request.stop,
      stream: false,
      tools: request.tools,
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
    const endpoint = `${this.config.baseUrl}/chat_completions?GroupId=${process.env.MINIMAX_GROUP_ID}`;

    const body = {
      model: request.model,
      messages: this.formatMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stop: request.stop,
      stream: true,
      tools: request.tools,
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
            // Skip invalid JSON
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
      encoding_format: request.encodingFormat ?? 'float',
    };

    const response = await this.request<unknown>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return this.parseEmbeddingResponse(response);
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey && process.env.MINIMAX_GROUP_ID);
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
          toolCalls: (choice.message as Record<string, unknown>)?.tool_calls as ToolCall[] | undefined,
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
      choices: (chunk.choices as Array<Record<string, unknown>> || []).map((c) => ({
        index: (c.index as number) || 0,
        delta: {
          role: (c.delta as Record<string, unknown>)?.role as string | undefined,
          content: (c.delta as Record<string, unknown>)?.content as string | undefined,
          toolCalls: (c.delta as Record<string, unknown>)?.tool_calls as StreamChunk['choices'][0]['delta']['toolCalls'],
        },
        finishReason: (c.finish_reason as string | undefined),
      })),
      usage: chunk.usage as StreamChunk['usage'],
    };
  }

  private parseEmbeddingResponse(response: unknown): EmbeddingResponse {
    const r = response as Record<string, unknown>;
    const data = (r.data as Array<Record<string, unknown>>) || [];

    return {
      model: (r.model as string) || 'embo-01',
      data: data.map((d, index) => ({
        index,
        embedding: d.embedding as number[],
      })),
      usage: {
        promptTokens: ((r.usage as Record<string, number>)?.prompt_tokens) || 0,
        completionTokens: 0,
        totalTokens: ((r.usage as Record<string, number>)?.total_tokens) || 0,
      },
    };
  }
}
