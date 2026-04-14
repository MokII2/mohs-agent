/**
 * Claude Provider (Anthropic)
 *
 * Integration with Anthropic Claude API.
 * API: https://api.anthropic.com/v1
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

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

export class ClaudeProvider extends BaseProvider {
  readonly id = 'claude';
  readonly name = 'Claude';
  readonly defaultModel = 'claude-sonnet-4-20250514';
  readonly supportedModels = [
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-haiku-4-20250514',
    'claude-3-5-opus-latest',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
    'claude-3-opus-latest',
    'claude-3-sonnet-latest',
    'claude-3-haiku-latest',
  ];

  constructor(config: { apiKey?: string } & ProviderConfig = {}) {
    super(config);
    this.config.baseUrl = ANTHROPIC_API_URL;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    // Claude uses messages API
    const endpoint = `${this.config.baseUrl}/messages`;
    const isStreaming = request.stream ?? false;

    const body = {
      model: request.model,
      messages: this.formatMessages(request.messages).filter(
        (m: { role: string }) => m.role !== 'system'
      ),
      system: this.extractSystemMessage(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens ?? 4096,
      top_p: request.topP,
      stop_sequences: request.stop,
      stream: isStreaming,
    };

    const response = await this.request<unknown>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        ...this.getHeaders(),
        'x-api-key': this.config.apiKey!,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
    });

    return this.parseResponse(response);
  }

  async chatStream(
    request: ChatCompletionRequest,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const endpoint = `${this.config.baseUrl}/messages`;

    const body = {
      model: request.model,
      messages: this.formatMessages(request.messages).filter(
        (m: { role: string }) => m.role !== 'system'
      ),
      system: this.extractSystemMessage(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens ?? 4096,
      top_p: request.topP,
      stop_sequences: request.stop,
      stream: true,
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey!,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
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
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta') {
              onChunk(this.parseStreamChunk(parsed));
            } else if (parsed.type === 'message_delta') {
              // Final usage info
            }
          } catch {
            // Skip
          }
        }
      }
    }
  }

  async embeddings(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Anthropic doesn't have embeddings, use a placeholder
    throw new Error('Embeddings not supported by Anthropic API');
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey);
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
    };
  }

  protected formatMessages(messages: import('../../types/index.js').Message[]): unknown[] {
    return messages
      .filter((msg) => msg.role !== 'system')
      .map((msg) => ({
        role: msg.role === 'tool' ? 'user' : msg.role,
        content: msg.toolCalls
          ? [
              { type: 'text', text: msg.content },
              ...msg.toolCalls.map((tc) => ({
                type: 'tool_use',
                id: tc.id,
                name: tc.name,
                input: tc.arguments,
              })),
            ]
          : msg.content,
      }));
  }

  private extractSystemMessage(messages: import('../../types/index.js').Message[]): string | undefined {
    const systemMsg = messages.find((m) => m.role === 'system');
    return systemMsg?.content;
  }

  protected parseResponse(response: unknown): ChatCompletionResponse {
    const r = response as Record<string, unknown>;

    const content = (r.content as Array<Record<string, unknown>>) || [];
    const textContent = content
      .filter((c) => c.type === 'text')
      .map((c) => c.text as string)
      .join('');

    const toolCalls = content
      .filter((c) => c.type === 'tool_use')
      .map((c) => ({
        id: c.id as string,
        name: (c as Record<string, unknown>).name as string,
        arguments: (c as Record<string, unknown>).input as Record<string, unknown>,
      }));

    const usage = r.usage as Record<string, number> | undefined;

    return {
      id: (r.id as string) || '',
      model: (r.model as string) || this.defaultModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: textContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          finishReason: (r.stop_reason as string) || 'stop',
        },
      ],
      usage: usage
        ? {
            promptTokens: usage.input_tokens || 0,
            completionTokens: usage.output_tokens || 0,
            totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
          }
        : undefined,
      created: Date.now(),
    };
  }

  private parseStreamChunk(chunk: Record<string, unknown>): StreamChunk {
    const delta = chunk.delta as Record<string, unknown>;

    return {
      id: '',
      choices: [
        {
          index: 0,
          delta: {
            content: delta.text as string | undefined,
          },
        },
      ],
    };
  }
}
