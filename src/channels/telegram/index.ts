/**
 * Telegram Channel Adapter (grammY)
 *
 * Integration with Telegram Bot API using grammY.
 * Note: Requires 'npm install grammy' to use
 */

import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

export class TelegramChannel extends BaseChannel {
  readonly id = 'telegram';
  readonly name = 'Telegram';
  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group', 'channel'],
    reactions: true,
    reply: true,
    media: true,
    mentions: true,
    threads: true,
  };

  async connect(): Promise<void> {
    // Stub - requires grammy package
    console.warn('[TelegramChannel] gramJS package not installed, using stub');
    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    console.log(`[TelegramChannel] Stub send to ${message.to}: ${message.content}`);
    return `stub-${Date.now()}`;
  }

  async sendTyping(peerId: string): Promise<void> {
    console.log(`[TelegramChannel] Stub typing to ${peerId}`);
  }
}
