/**
 * Channel Registry
 *
 * Central registry for all channel adapters.
 * Manages channel registration, configuration, and routing.
 */

import type { IChannel, ChannelConfig, ChannelStatus } from './base/types.js';
import { BaseChannel } from './base/index.js';

export { BaseChannel } from './base/index.js';
export * from './base/types.js';
export { TelegramChannel } from './telegram/index.js';
export { DiscordChannel } from './discord/index.js';
export { WhatsAppChannel } from './whatsapp/index.js';
export { SlackChannel } from './slack/index.js';
export { WeChatChannel } from './wechat/index.js';
export { WebChatChannel } from './webchat/index.js';
export { FeishuChannel } from './feishu/index.js';
export { MSTeamsChannel } from './msteams/index.js';
export { BlueBubblesChannel } from './bluebubbles/index.js';
export { IMessageChannel } from './imessage/index.js';

/**
 * Channel registry
 */
export class ChannelRegistry {
  private channels: Map<string, IChannel> = new Map();

  /**
   * Register a channel
   */
  register(channel: IChannel): void {
    this.channels.set(channel.id, channel);
  }

  /**
   * Unregister a channel
   */
  async unregister(channelId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (channel) {
      await channel.disconnect();
      this.channels.delete(channelId);
      return true;
    }
    return false;
  }

  /**
   * Get channel by ID
   */
  get(channelId: string): IChannel | undefined {
    return this.channels.get(channelId);
  }

  /**
   * Get all registered channels
   */
  getAll(): IChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get all channel statuses
   */
  getAllStatuses(): Array<{ id: string; name: string; status: ChannelStatus }> {
    return Array.from(this.channels.values()).map((ch) => ({
      id: ch.id,
      name: ch.name,
      status: ch.getStatus(),
    }));
  }

  /**
   * Connect all channels
   */
  async connectAll(): Promise<void> {
    const promises = Array.from(this.channels.values()).map((ch) => ch.connect());
    await Promise.allSettled(promises);
  }

  /**
   * Disconnect all channels
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.channels.values()).map((ch) => ch.disconnect());
    await Promise.allSettled(promises);
  }

  /**
   * Find channel by ID prefix
   */
  findByPrefix(prefix: string): IChannel | undefined {
    return Array.from(this.channels.values()).find(
      (ch) => ch.id.startsWith(prefix) || ch.name.toLowerCase().startsWith(prefix.toLowerCase())
    );
  }

  /**
   * Get count of connected channels
   */
  get connectedCount(): number {
    return Array.from(this.channels.values()).filter((ch) => ch.getStatus().connected).length;
  }
}

// Export singleton
export const channelRegistry = new ChannelRegistry();
