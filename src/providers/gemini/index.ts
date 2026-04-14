/**
 * Gemini Provider (Google AI)
 *
 * Integration with Google Gemini API.
 * API: https://generativelanguage.googleapis.com/v1beta
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

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiProvider extends BaseProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly defaultModel = 'gemini-1.5-flash';
  readonly supportedModels = [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.0-pro',
    'gemini-1.0-pro-001',
    'gemini-1.0-pro-exp',
    'gemini-1.0-ultra',
  ];

  constructor(config: { apiKey?: string } & ProviderConfig = {}) {
    super(config);
    this.config.baseUrl = GEMINI_API_URL;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model.replace('gemini-', 'models/');
    const endpoint = `${this.config.baseUrl}/${model}:generateContent?key=${this.config.apiKey}`;

    const body = {
      contents: this.formatMessages(request.messages),
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
        topP: request.topP,
        stopSequences: request.stop,
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
    const model = request.model.replace('gemini-', 'models/');
    const endpoint = `${this.config.baseUrl}/${model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`;

    const body = {
      contents: this.formatMessages(request.messages),
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
        topP: request.topP,
        stopSequences: request.stop,
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
          // Skip invalid JSON
        }
      }
    }
  }

  async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const endpoint = `${this.config.baseUrl}/models/embedding-001:batchEmbedContents?key=${this.config.apiKey}`;

    const body = {
      model: 'models/embedding-001',
      requests: (Array.isArray(request.input) ? request.input : [request.input]).map((text) => ({
        content: text,
      })),
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
    const contents: Array<Record<string, unknown>> = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue;

      if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content }],
        });
      }
    }

    return contents;
  }

  protected parseResponse(response: unknown): ChatCompletionResponse {
    const r = response as Record<string, unknown>;
    const candidates = (r.candidates as Array<Record<string, unknown>>) || [];
    const firstCandidate = candidates[0];
    const content = firstCandidate?.content as Record<string, unknown>;
    const parts = (content?.parts as Array<Record<string, unknown>>) || [];

    return {
      id: (r.modelVersion as string[])?.join(',') || this.defaultModel,
      model: this.defaultModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: parts.map((p) => p.text as string).join(''),
          },
          finishReason: (firstCandidate?.finishReason as string) || 'STOP',
        },
      ],
      usage: this.parseUsage(r.usageMetadata as Record<string, number>),
      created: Date.now(),
    };
  }

  private parseStreamChunk(chunk: Record<string, unknown>): StreamChunk {
    const candidates = (chunk.candidates as Array<Record<string, unknown>>) || [];
    const firstCandidate = candidates[0];
    const content = firstCandidate?.content as Record<string, unknown>;
    const parts = (content?.parts as Array<Record<string, unknown>>) || [];

    return {
      id: this.defaultModel,
      choices: [
        {
          index: 0,
          delta: {
            content: parts.map((p) => p.text as string).join(''),
          },
          finishReason: firstCandidate?.finishReason as string | undefined,
        },
      ],
    };
  }

  private parseUsage(usageMetadata: Record<string, number> | undefined): UsageInfo | undefined {
    if (!usageMetadata) return undefined;
    return {
      promptTokens: usageMetadata.totalTokenCount || 0,
      completionTokens: usageMetadata.candidatesTokenCount || 0,
      totalTokens: usageMetadata.totalTokenCount || 0,
    };
  }

  private parseEmbeddingResponse(response: unknown): EmbeddingResponse {
    const r = response as Record<string, unknown>;
    const embeddings = (r.embeddings as Array<{ values: number[] }>) || [];

    return {
      model: 'embedding-001',
      data: embeddings.map((e, index) => ({
        index,
        embedding: e.values,
      })),
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}

interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
