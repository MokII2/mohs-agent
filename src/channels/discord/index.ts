/**
 * Discord Channel Adapter (discord.js)
 *
 * Integration with Discord API using discord.js.
 * Note: Requires 'npm install discord.js' to use
 */

import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

export class DiscordChannel extends BaseChannel {
  readonly id = 'discord';
  readonly name = 'Discord';
  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group', 'channel', 'thread'],
    reactions: true,
    edit: true,
    unsend: true,
    reply: true,
    media: true,
    mentions: true,
    threads: true,
  };

  async connect(): Promise<void> {
    console.warn('[DiscordChannel] discord.js package not installed, using stub');
    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    console.log(`[DiscordChannel] Stub send to ${message.to}: ${message.content}`);
    return `stub-${Date.now()}`;
  }

  async sendTyping(peerId: string): Promise<void> {
    console.log(`[DiscordChannel] Stub typing to ${peerId}`);
  }
}
