/**
 * iMessage Channel Adapter (Legacy)
 *
 * Integration with iMessage via imessage-service or similar.
 * This is a legacy adapter using the older iMsg protocol.
 *
 * Note: BlueBubbles is recommended for macOS iMessage integration.
 */

import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

export class IMessageChannel extends BaseChannel {
  readonly id = 'imessage';
  readonly name = 'iMessage (Legacy)';
  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group'],
    reactions: true,
    reply: true,
    media: true,
    mentions: false,
  };

  private serverUrl?: string;
  private authToken?: string;

  async initialize(config: ChannelConfig & {
    serverUrl: string;
    authToken?: string;
  }): Promise<void> {
    await super.initialize(config);
    this.serverUrl = config.serverUrl;
    this.authToken = config.authToken;
  }

  async connect(): Promise<void> {
    if (!this.serverUrl) {
      throw new Error('iMessage server URL is required');
    }

    // Verify connection
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.serverUrl}/status`, { headers });

    if (!response.ok) {
      throw new Error('Failed to connect to iMessage server');
    }

    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    if (!this.serverUrl) {
      throw new Error('Not connected');
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(`${this.serverUrl}/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: message.to,
        text: message.content,
      }),
    });

    const result = await response.json() as { success?: boolean; messageId?: string; error?: string };

    if (!result.success) {
      throw new Error(result.error || 'Failed to send message');
    }

    return result.messageId || '';
  }

  async sendTyping(_peerId: string): Promise<void> {
    // iMessage doesn't support typing indicators
  }
}
