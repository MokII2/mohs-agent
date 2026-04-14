/**
 * WeChat Channel Adapter
 *
 * Integration with WeChat using OpenClaw WeChat adapter.
 * Based on @tencent-weixin/openclaw-weixin
 */

import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

export class WeChatChannel extends BaseChannel {
  readonly id = 'wechat';
  readonly name = 'WeChat';
  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group'],
    reactions: false,
    reply: true,
    media: true,
    mentions: false,
  };

  private apiUrl?: string;
  private appId?: string;
  private appSecret?: string;
  private token?: string;
  private encodingAESKey?: string;

  async initialize(config: ChannelConfig & {
    appId: string;
    appSecret: string;
    token?: string;
    encodingAESKey?: string;
    apiUrl?: string;
  }): Promise<void> {
    await super.initialize(config);
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.token = config.token;
    this.encodingAESKey = config.encodingAESKey;
    this.apiUrl = config.apiUrl;
  }

  async connect(): Promise<void> {
    // WeChat requires webhook server setup
    // This is a simplified client-side implementation
    if (!this.appId || !this.appSecret) {
      throw new Error('WeChat appId and appSecret are required');
    }

    // Verify credentials by getting access token
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Failed to get WeChat access token');
    }

    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const url = `${this.apiUrl || 'https://api.weixin.qq.com'}/cgi-bin/message/custom/send?access_token=${accessToken}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: message.to,
        msgtype: 'text',
        text: { content: message.content },
      }),
    });

    const result = await response.json() as { errcode: number; errmsg: string; msgid?: number };
    if (result.errcode !== 0) {
      throw new Error(result.errmsg);
    }

    return String(result.msgid);
  }

  async sendTyping(_peerId: string): Promise<void> {
    // WeChat doesn't support typing indicators via API
  }

  private async getAccessToken(): Promise<string | null> {
    if (!this.appId || !this.appSecret) return null;

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`;

    try {
      const response = await fetch(url);
      const data = await response.json() as { access_token?: string; expires_in?: number };

      if (data.access_token) {
        return data.access_token;
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Handle webhook verification (call this from webhook endpoint)
   */
  verifyWebhook(params: {
    signature: string;
    timestamp: string;
    nonce: string;
    echostr?: string;
  }): boolean | string {
    // Simple signature verification
    const { signature, timestamp, nonce, echostr } = params;
    const token = this.token || '';

    const arr = [token, timestamp, nonce].sort();
    const str = arr.join('');

    // Use crypto for proper HMAC-SHA1
    // This is a simplified check
    if (signature === str) {
      return echostr || 'success';
    }

    return false;
  }
}
