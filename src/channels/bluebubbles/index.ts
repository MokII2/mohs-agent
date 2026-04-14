/**
 * BlueBubbles Channel Adapter (iMessage on Mac)
 *
 * Integration with BlueBubbles Server for iMessage.
 * Recommended iMessage solution for Mac.
 */

import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

export class BlueBubblesChannel extends BaseChannel {
  readonly id = 'bluebubbles';
  readonly name = 'BlueBubbles';
  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group'],
    reactions: true,
    reply: true,
    media: true,
    mentions: false,
  };

  private serverUrl?: string;
  private password?: string;

  async initialize(config: ChannelConfig & {
    serverUrl: string;
    password: string;
  }): Promise<void> {
    await super.initialize(config);
    this.serverUrl = config.serverUrl;
    this.password = config.password;
  }

  async connect(): Promise<void> {
    if (!this.serverUrl || !this.password) {
      throw new Error('BlueBubbles server URL and password are required');
    }

    // Verify connection by fetching server info
    const response = await fetch(`${this.serverUrl}/api/v1/server/info`, {
      headers: { Authorization: `Bearer ${this.password}` },
    });

    if (!response.ok) {
      throw new Error('Failed to connect to BlueBubbles server');
    }

    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    if (!this.serverUrl || !this.password) {
      throw new Error('Not connected');
    }

    const response = await fetch(`${this.serverUrl}/api/v1/chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.password}`,
      },
      body: JSON.stringify({
        chatGuid: message.to,
        message: message.content,
        tempGuid: `temp-${Date.now()}`,
      }),
    });

    const result = await response.json() as { success: boolean; data?: { message: { guid: string } } };

    if (!result.success) {
      throw new Error('Failed to send message');
    }

    return result.data?.message?.guid || '';
  }

  async sendTyping(peerId: string): Promise<void> {
    if (!this.serverUrl || !this.password) return;

    await fetch(`${this.serverUrl}/api/v1/chat/typing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.password}`,
      },
      body: JSON.stringify({ chatGuid: peerId }),
    });
  }

  /**
   * Get list of active chats
   */
  async getChats(): Promise<Array<{ guid: string; displayName: string }>> {
    if (!this.serverUrl || !this.password) {
      throw new Error('Not connected');
    }

    const response = await fetch(`${this.serverUrl}/api/v1/chats`, {
      headers: { Authorization: `Bearer ${this.password}` },
    });

    const result = await response.json() as { success: boolean; data?: Array<{ guid: string; displayName: string }> };
    return result?.data || [];
  }
}
