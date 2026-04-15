/**
 * Discord Channel Adapter (discord.js)
 *
 * Integration with Discord API using discord.js.
 */

import { Client, GatewayIntentBits, GuildTextBasedChannel, Message } from 'discord.js';
import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

interface DiscordChannelConfig extends ChannelConfig {
  botToken: string;
}

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

  private client?: Client;
  private botToken?: string;

  async initialize(config: ChannelConfig): Promise<void> {
    await super.initialize(config);
    const discordConfig = config as DiscordChannelConfig;
    this.botToken = discordConfig.botToken;

    if (!this.botToken) {
      throw new Error('Discord bot token is required');
    }
  }

  async connect(): Promise<void> {
    if (!this.botToken) {
      throw new Error('Bot token not configured');
    }

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });

    this.client.on('messageCreate', async (message: Message) => {
      if (!this.messageHandler || message.author.bot) {
        return;
      }

      const inboundMessage: InboundMessage = {
        id: `discord-${message.id}`,
        channelId: this.id,
        peerId: message.channelId,
        senderId: message.author.id,
        senderName: message.author.username,
        content: message.content,
        timestamp: message.createdTimestamp,
        raw: message,
      };

      await this.messageHandler(inboundMessage);
    });

    // Handle slash commands
    this.client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) {
        return;
      }

      if (interaction.commandName === 'start') {
        await interaction.reply({
          content: `Welcome! I'm Mohs-agent Discord bot.

I can help you with:
• Answering questions
• Text processing
• General assistance

Just send me a message and I'll respond!`,
          ephemeral: false,
        });
      } else if (interaction.commandName === 'help') {
        await interaction.reply({
          content: `*Available Commands:*

/start - Start conversation
/help - Show this help

*Just type your question* - I'll respond directly!`,
          ephemeral: false,
        });
      }
    });

    await this.client.login(this.botToken);

    // Wait for client to be ready
    await new Promise<void>((resolve) => {
      this.client!.once('ready', () => resolve());
    });

    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = undefined;
    }
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    if (!this.client) {
      throw new Error('Discord client not connected');
    }

    try {
      const channel = await this.client.channels.fetch(message.to);
      if (!channel || !channel.isTextBased()) {
        throw new Error('Channel not found or not text-based');
      }

      const textChannel = channel as GuildTextBasedChannel;
      const sentMessage = await textChannel.send({
        content: message.content,
        reply: message.replyTo ? { messageReference: message.replyTo } : undefined,
      });

      return `discord-${sentMessage.id}`;
    } catch (error) {
      console.error('[DiscordChannel] Send error:', error);
      throw error;
    }
  }

  async sendTyping(peerId: string): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const channel = await this.client.channels.fetch(peerId);
      if (channel && channel.isTextBased()) {
        const textChannel = channel as GuildTextBasedChannel;
        await textChannel.sendTyping();
      }
    } catch {
      // Ignore typing indicator errors
    }
  }
}
