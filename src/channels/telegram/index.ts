/**
 * Telegram Channel Adapter (grammY)
 *
 * Integration with Telegram Bot API using grammY.
 */

import { Bot, Context, session } from 'grammy';
import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

interface TelegramChannelConfig extends ChannelConfig {
  botToken: string;
}

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

  private bot?: Bot;
  private botToken?: string;

  async initialize(config: ChannelConfig): Promise<void> {
    await super.initialize(config);
    const tgConfig = config as TelegramChannelConfig;
    this.botToken = tgConfig.botToken;

    if (!this.botToken) {
      throw new Error('Telegram bot token is required');
    }
  }

  async connect(): Promise<void> {
    if (!this.botToken) {
      throw new Error('Bot token not configured. Call initialize() first.');
    }

    this.bot = new Bot(this.botToken);

    // Handle messages
    this.bot.on('message:text', async (ctx) => {
      if (!this.messageHandler) return;

      const msg = ctx.message;
      const chat = ctx.chat;

      const inboundMessage: InboundMessage = {
        id: `tg-${msg.message_id}`,
        channelId: this.id,
        peerId: String(chat.id),
        senderId: String(msg.from?.id),
        senderName: msg.from?.first_name || 'Unknown',
        content: msg.text || '',
        timestamp: msg.date * 1000, // Convert to milliseconds
        raw: msg,
      };

      await this.messageHandler(inboundMessage);
    });

    // Handle /start command
    this.bot.command('start', async (ctx) => {
      const botName = ctx.me.first_name || 'Mohs Agent';
      const welcomeMessage = `Welcome! I'm ${botName}.

I'm an AI assistant that can help you with:
• Answering questions
• Text processing
• General assistance

Just send me a message and I'll respond!`;

      await ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
      });
    });

    // Handle /help command
    this.bot.command('help', async (ctx) => {
      const helpMessage = `*Available Commands:*

/start - Start conversation
/help - Show this help
/stats - Show session statistics

*Just type your question* - I'll respond directly!`;

      await ctx.reply(helpMessage, {
        parse_mode: 'Markdown',
      });
    });

    // Handle callbacks from inline keyboards
    this.bot.on('callback_query', async (ctx) => {
      await ctx.answerCallbackQuery();
    });

    // Start polling
    await this.bot.start();
    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      await this.bot.stop();
      this.bot = undefined;
    }
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    if (!this.bot) {
      throw new Error('Bot not connected');
    }

    const chatId = message.to;
    const content = message.content;

    try {
      const msg = await this.bot.api.sendMessage(chatId, content, {
        parse_mode: 'HTML',
        reply_to_message_id: message.replyTo ? parseInt(message.replyTo) : undefined,
      });

      return `tg-${msg.message_id}`;
    } catch (error) {
      console.error('[TelegramChannel] Send error:', error);
      throw error;
    }
  }

  async sendTyping(peerId: string): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      await this.bot.api.sendChatAction(peerId, 'typing');
    } catch {
      // Ignore errors for typing indicator
    }
  }

  onMessage(handler: (msg: InboundMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }
}
