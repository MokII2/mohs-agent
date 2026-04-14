/**
 * Provider Base Types
 *
 * Abstract interfaces for LLM providers. Each provider implements
 * the common interface for chat completion and embeddings.
 */

import type { Message, ToolCall } from '../../types/index.js';

/**
 * Chat completion request
 */
export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  stream?: boolean;
  tools?: ToolDefinition[];
  toolChoice?: string | { type: 'function'; function: { name: string } };
}

/**
 * Chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: ChatChoice[];
  usage?: UsageInfo;
  created: number;
}

/**
 * Chat choice
 */
export interface ChatChoice {
  index: number;
  message: {
    role: string;
    content: string;
    toolCalls?: ToolCall[];
  };
  finishReason: string;
}

/**
 * Usage information
 */
export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Tool definition for function calling
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Streaming chunk
 */
export interface StreamChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      toolCalls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finishReason?: string;
  }>;
  usage?: UsageInfo;
}

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encodingFormat?: 'float' | 'base64';
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  model: string;
  data: Array<{
    index: number;
    embedding: number[];
  }>;
  usage: UsageInfo;
}

/**
 * Base provider interface
 */
export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  readonly defaultModel: string;
  readonly supportedModels: string[];

  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  chatStream(request: ChatCompletionRequest, onChunk: (chunk: StreamChunk) => void): Promise<void>;
  embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  /**
   * Check if provider is available (has valid auth)
   */
  isAvailable(): boolean;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
}
