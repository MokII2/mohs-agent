/**
 * Base Channel Abstract Class
 *
 * Provides common functionality for all channel adapters.
 */

import type {
  IChannel,
  ChannelConfig,
  ChannelStatus,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
  MessageHandler,
} from './types.js';

export abstract class BaseChannel implements IChannel {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly capabilities: ChannelCapabilities;

  protected config: ChannelConfig = { enabled: false };
  protected status: ChannelStatus = { connected: false, authenticated: false };
  protected messageHandler?: MessageHandler;

  async initialize(config: ChannelConfig): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(message: OutboundMessage): Promise<string>;
  abstract sendTyping(peerId: string): Promise<void>;

  getStatus(): ChannelStatus {
    return { ...this.status };
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandler = handler;
  }

  protected async handleMessage(message: InboundMessage): Promise<void> {
    if (this.messageHandler) {
      await this.messageHandler(message);
    }
  }

  /**
   * Format timestamp to ISO string
   */
  protected formatTimestamp(timestamp?: number): string {
    return timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
  }

  /**
   * Sanitize content - basic XSS prevention
   */
  protected sanitizeContent(content: string): string {
    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}
