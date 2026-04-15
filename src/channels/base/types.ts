/**
 * Channel Base Types
 *
 * Abstract interfaces for channel adapters.
 * Each channel implements the common interface for messaging.
 */

import type { Message } from '../../types/index.js';

/**
 * Inbound message from channel
 */
export interface InboundMessage {
  id: string;
  channelId: string;
  peerId: string;
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: number;
  raw?: unknown;
  attachments?: Attachment[];
}

/**
 * Attachment in message
 */
export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'file';
  url?: string;
  data?: Buffer;
  name?: string;
  mimeType?: string;
}

/**
 * Outbound message
 */
export interface OutboundMessage {
  to: string;
  content: string;
  attachments?: Attachment[];
  replyTo?: string;
}

/**
 * Channel capability
 */
export interface ChannelCapabilities {
  chatTypes: Array<'direct' | 'group' | 'channel' | 'thread'>;
  polls?: boolean;
  reactions?: boolean;
  edit?: boolean;
  unsend?: boolean;
  reply?: boolean;
  media?: boolean;
  mentions?: boolean;
  threads?: boolean;
}

/**
 * Channel config
 */
export interface ChannelConfig {
  enabled: boolean;
  botToken?: string;
  signingSecret?: string;
  appId?: string;
  appSecret?: string;
  webhookUrl?: string;
  pollingInterval?: number;
}

/**
 * Channel status
 */
export interface ChannelStatus {
  connected: boolean;
  authenticated: boolean;
  lastHeartbeat?: number;
  error?: string;
}

/**
 * Base channel interface
 */
export interface IChannel {
  readonly id: string;
  readonly name: string;
  readonly capabilities: ChannelCapabilities;

  /**
   * Initialize the channel adapter
   */
  initialize(config: ChannelConfig): Promise<void>;

  /**
   * Connect to the channel
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the channel
   */
  disconnect(): Promise<void>;

  /**
   * Get channel status
   */
  getStatus(): ChannelStatus;

  /**
   * Send a message
   */
  send(message: OutboundMessage): Promise<string>;

  /**
   * Send typing indicator
   */
  sendTyping(peerId: string): Promise<void>;

  /**
   * Set message handler for inbound messages
   */
  onMessage(handler: MessageHandler): void;

  /**
   * Set reaction handler
   */
  onReaction?(handler: ReactionHandler): void;

  /**
   * Set edit handler
   */
  onEdit?(handler: EditHandler): void;
}

/**
 * Message handler type
 */
export type MessageHandler = (message: InboundMessage) => Promise<void>;

/**
 * Reaction handler type
 */
export type ReactionHandler = (data: { messageId: string; emoji: string; userId: string }) => Promise<void>;

/**
 * Edit handler type
 */
export type EditHandler = (data: { messageId: string; newContent: string }) => Promise<void>;
