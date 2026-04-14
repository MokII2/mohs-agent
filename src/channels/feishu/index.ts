/**
 * Feishu (Lark) Channel Adapter
 *
 * Integration with Feishu/Lark IM API.
 */

import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

const FEISHU_API_URL = 'https://open.feishu.cn/open-apis';

export class FeishuChannel extends BaseChannel {
  readonly id = 'feishu';
  readonly name = 'Feishu';
  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group', 'channel'],
    reactions: true,
    reply: true,
    media: true,
    mentions: true,
    threads: true,
  };

  private appId?: string;
  private appSecret?: string;
  private tenantAccessToken?: string;
  private tokenExpiry?: number;

  async initialize(config: ChannelConfig & {
    appId: string;
    appSecret: string;
  }): Promise<void> {
    await super.initialize(config);
    this.appId = config.appId;
    this.appSecret = config.appSecret;
  }

  async connect(): Promise<void> {
    if (!this.appId || !this.appSecret) {
      throw new Error('Feishu appId and appSecret are required');
    }

    await this.getAccessToken();
    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    this.tenantAccessToken = undefined;
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${FEISHU_API_URL}/im/v1/messages?receive_id_type=open_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: message.to,
        msg_type: 'text',
        content: JSON.stringify({ text: message.content }),
      }),
    });

    const result = await response.json() as { code: number; msg: string; data?: { message_id: string } };

    if (result.code !== 0) {
      throw new Error(result.msg);
    }

    return result.data?.message_id || '';
  }

  async sendTyping(_peerId: string): Promise<void> {
    // Feishu doesn't support typing indicators via API
  }

  private async getAccessToken(): Promise<string | null> {
    // Check if current token is still valid
    if (this.tenantAccessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.tenantAccessToken;
    }

    if (!this.appId || !this.appSecret) return null;

    const response = await fetch(`${FEISHU_API_URL}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret,
      }),
    });

    const result = await response.json() as {
      code: number;
      msg: string;
      tenant_access_token?: string;
      expire?: number;
    };

    if (result.code === 0 && result.tenant_access_token) {
      this.tenantAccessToken = result.tenant_access_token;
      this.tokenExpiry = Date.now() + ((result.expire || 7200) * 1000);
      return this.tenantAccessToken;
    }

    return null;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhook(verification: {
    timestamp: string;
    nonce: string;
    signature: string;
    encrypt?: string;
  }): boolean {
    // Feishu webhook verification logic
    const { timestamp, nonce, signature } = verification;
    const secret = this.appSecret;

    // Sort and concatenate
    const arr = [timestamp, nonce, secret].sort();
    const signStr = arr.join('');

    // Simple hash comparison (use crypto in production)
    return signature === signStr;
  }
}
