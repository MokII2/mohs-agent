/**
 * Microsoft Teams Channel Adapter
 *
 * Integration with Microsoft Teams using Bot Framework.
 */

import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

const TEAMS_API_URL = 'https://smba.trafficmanager.net/teams';

export class MSTeamsChannel extends BaseChannel {
  readonly id = 'msteams';
  readonly name = 'Microsoft Teams';
  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group', 'channel', 'thread'],
    reactions: true,
    reply: true,
    media: true,
    mentions: true,
    threads: true,
  };

  private appId?: string;
  private appPassword?: string;
  private accessToken?: string;
  private tokenExpiry?: number;

  async initialize(config: ChannelConfig & {
    appId: string;
    appPassword: string;
  }): Promise<void> {
    await super.initialize(config);
    this.appId = config.appId;
    this.appPassword = config.appPassword;
  }

  async connect(): Promise<void> {
    if (!this.appId || !this.appPassword) {
      throw new Error('Microsoft Teams appId and appPassword are required');
    }

    await this.getAccessToken();
    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    this.accessToken = undefined;
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${TEAMS_API_URL}/v3/conversations/${message.to}/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: 'message',
        text: message.content,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }

    const result = await response.json() as { id?: string };
    return result?.id || '';
  }

  async sendTyping(_peerId: string): Promise<void> {
    // Teams typing indicator support is limited
  }

  private async getAccessToken(): Promise<string | null> {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.appId || !this.appPassword) return null;

    const response = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.appId,
        client_secret: this.appPassword,
        scope: 'https://api.botframework.com/.default',
      }),
    });

    const result = await response.json() as { access_token?: string; expires_in?: number };

    if (result.access_token) {
      this.accessToken = result.access_token;
      this.tokenExpiry = Date.now() + ((result.expires_in || 3600) * 1000);
      return this.accessToken;
    }

    return null;
  }
}
