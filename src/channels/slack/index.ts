/**
 * Slack Channel Adapter (Bolt)
 *
 * Integration with Slack using Bolt framework.
 * Note: Requires 'npm install @slack/bolt' to use
 */

import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

export class SlackChannel extends BaseChannel {
  readonly id = 'slack';
  readonly name = 'Slack';
  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group', 'channel', 'thread'],
    reactions: true,
    edit: true,
    reply: true,
    media: true,
    mentions: true,
    threads: true,
  };

  async connect(): Promise<void> {
    console.warn('[SlackChannel] @slack/bolt package not installed, using stub');
    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    console.log(`[SlackChannel] Stub send to ${message.to}: ${message.content}`);
    return `stub-${Date.now()}`;
  }

  async sendTyping(peerId: string): Promise<void> {
    console.log(`[SlackChannel] Stub typing to ${peerId}`);
  }
}
