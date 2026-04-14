/**
 * OpenAI GPT Provider
 *
 * Integration with OpenAI GPT API.
 * API: https://api.openai.com/v1
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

const OPENAI_API_URL = 'https://api.openai.com/v1';

export class GPTProvider extends BaseProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI GPT';
  readonly defaultModel = 'gpt-4o';
  readonly supportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
    'gpt-4',
    'gpt-4-32k',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-16k',
  ];

  constructor(config: { apiKey?: string; organization?: string } & ProviderConfig = {}) {
    super(config);
    this.config.baseUrl = OPENAI_API_URL;
    if (config.organization) {
      this.config.organization = config.organization;
    }
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
      tools: request.tools?.map((t) => ({
        type: 'function',
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        },
      })),
      tool_choice: request.toolChoice,
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
      tools: request.tools?.map((t) => ({
        type: 'function',
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        },
      })),
      tool_choice: request.toolChoice,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.organization ? { 'OpenAI-Organization': this.config.organization } : {}),
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
      encoding_format: request.encodingFormat ?? 'float',
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

  protected getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    if (this.config.organization) {
      headers['OpenAI-Organization'] = this.config.organization;
    }
    return headers;
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
          toolCalls: this.parseToolCalls(choice.message as Record<string, unknown>),
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

  private parseToolCalls(message: Record<string, unknown>): import('../../types/index.js').ToolCall[] | undefined {
    const toolCalls = message.tool_calls as Array<Record<string, unknown>> | undefined;
    if (!toolCalls) return undefined;

    return toolCalls.map((tc) => ({
      id: tc.id as string,
      name: ((tc.function as Record<string, unknown>)?.name as string) || '',
      arguments: ((tc.function as Record<string, unknown>)?.arguments as Record<string, unknown>) || {},
    }));
  }

  private parseStreamChunk(chunk: Record<string, unknown>): StreamChunk {
    return {
      id: (chunk.id as string) || '',
      choices: ((chunk.choices as Array<Record<string, unknown>>) || []).map((c) => ({
        index: (c.index as number) || 0,
        delta: {
          role: (c.delta as Record<string, unknown>)?.role as string | undefined,
          content: (c.delta as Record<string, unknown>)?.content as string | undefined,
          toolCalls: this.parseStreamToolCalls(c.delta as Record<string, unknown>),
        },
        finishReason: (c.finish_reason as string | undefined),
      })),
    };
  }

  private parseStreamToolCalls(delta: Record<string, unknown>): StreamChunk['choices'][0]['delta']['toolCalls'] {
    const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
    if (!toolCalls) return undefined;

    return toolCalls.map((tc) => ({
      id: tc.id as string,
      type: 'function' as const,
      function: {
        name: ((tc.function as Record<string, unknown>)?.name as string) || '',
        arguments: JSON.stringify(((tc.function as Record<string, unknown>)?.arguments) || {}),
      },
    }));
  }

  private parseEmbeddingResponse(response: unknown): EmbeddingResponse {
    const r = response as Record<string, unknown>;
    const data = (r.data as Array<Record<string, unknown>>) || [];

    return {
      model: (r.model as string) || 'text-embedding-3-small',
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
