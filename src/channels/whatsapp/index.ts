/**
 * WhatsApp Channel Adapter (Baileys)
 *
 * Integration with WhatsApp using Baileys library.
 * Note: Requires 'npm install @whiskeysockets/baileys' to use
 */

import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

export class WhatsAppChannel extends BaseChannel {
  readonly id = 'whatsapp';
  readonly name = 'WhatsApp';
  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group'],
    reactions: true,
    reply: true,
    media: true,
    mentions: true,
  };

  async connect(): Promise<void> {
    console.warn('[WhatsAppChannel] @whiskeysockets/baileys package not installed, using stub');
    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    console.log(`[WhatsAppChannel] Stub send to ${message.to}: ${message.content}`);
    return `stub-${Date.now()}`;
  }

  async sendTyping(peerId: string): Promise<void> {
    console.log(`[WhatsAppChannel] Stub typing to ${peerId}`);
  }
}
