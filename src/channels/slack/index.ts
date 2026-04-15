/**
 * Slack Channel Adapter (Bolt)
 *
 * Integration with Slack using Bolt framework.
 */

import { App } from '@slack/bolt';
import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

interface SlackChannelConfig extends ChannelConfig {
  botToken: string;
  signingSecret: string;
  port?: number;
}

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

  private app?: App;

  async initialize(config: ChannelConfig): Promise<void> {
    await super.initialize(config);
    const slackConfig = config as SlackChannelConfig;
    const botToken = slackConfig.botToken;
    const signingSecret = slackConfig.signingSecret;

    if (!botToken || !signingSecret) {
      throw new Error('Slack bot token and signing secret are required');
    }
  }

  async connect(): Promise<void> {
    const slackConfig = this.config as SlackChannelConfig;
    const botToken = slackConfig.botToken;
    const signingSecret = slackConfig.signingSecret;

    if (!botToken || !signingSecret) {
      throw new Error('Bot token and signing secret not configured');
    }

    this.app = new App({
      token: botToken,
      signingSecret: signingSecret,
    });

    // Handle messages
    this.app.message(async ({ message, say }) => {
      if (!this.messageHandler || message.type !== 'message' || !('text' in message)) {
        return;
      }

      const slackMessage = message as {
        text: string;
        user: string;
        channel: string;
        ts: string;
        thread_ts?: string;
      };

      // Skip messages without user info
      if (!slackMessage.user) {
        return;
      }

      const inboundMessage: InboundMessage = {
        id: `slack-${slackMessage.ts}`,
        channelId: this.id,
        peerId: slackMessage.channel,
        senderId: slackMessage.user,
        senderName: slackMessage.user,
        content: slackMessage.text,
        timestamp: parseInt(slackMessage.ts.split('.')[0]) * 1000,
        raw: slackMessage,
      };

      await this.messageHandler(inboundMessage);
    });

    // Handle /start command
    this.app.command('/start', async ({ command, ack, say }) => {
      await ack();
      const welcomeMessage = `Welcome! I'm Mohs-agent Slack bot.

I can help you with:
• Answering questions
• Text processing
• General assistance

Just send me a direct message and I'll respond!`;

      await say(welcomeMessage);
    });

    // Handle /help command
    this.app.command('/help', async ({ command, ack, say }) => {
      await ack();
      const helpMessage = `*Available Commands:*

/start - Start conversation
/help - Show this help

*Just type your question* - I'll respond directly!`;

      await say(helpMessage);
    });

    // Start the app
    const port = (this.config as SlackChannelConfig).port || 3000;
    await this.app.start(port);
    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    if (this.app) {
      await this.app.stop();
      this.app = undefined;
    }
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    if (!this.app) {
      throw new Error('Slack app not connected');
    }

    try {
      const result = await this.app.client.chat.postMessage({
        channel: message.to,
        text: message.content,
        thread_ts: message.replyTo,
      });

      return `slack-${result.ts}`;
    } catch (error) {
      console.error('[SlackChannel] Send error:', error);
      throw error;
    }
  }

  async sendTyping(peerId: string): Promise<void> {
    if (!this.app) {
      return;
    }

    try {
      await this.app.client.chat.postMessage({
        channel: peerId,
        text: '...',
        unfurl_links: false,
      });
    } catch {
      // Ignore typing indicator errors
    }
  }
}
