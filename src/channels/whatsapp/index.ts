/**
 * WhatsApp Channel Adapter (Baileys)
 *
 * Integration with WhatsApp using Baileys library.
 * Supports QR code authentication for WhatsApp Web.
 */

import { useMultiFileAuthState, makeWASocket, DisconnectReason, AnyMessageContent, WAMessage } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';
import { mkdir } from 'fs/promises';

interface WhatsAppChannelConfig extends ChannelConfig {
  sessionDir?: string;
}

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

  private sock?: ReturnType<typeof makeWASocket>;
  private sessionDir?: string;
  private isConnected = false;
  private qrCallback?: (qr: string) => void;

  async initialize(config: ChannelConfig): Promise<void> {
    await super.initialize(config);
    const waConfig = config as WhatsAppChannelConfig;
    this.sessionDir = waConfig.sessionDir || './wa-session';

    // Ensure session directory exists
    try {
      await mkdir(this.sessionDir, { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  async connect(): Promise<void> {
    if (!this.sessionDir) {
      throw new Error('Session directory not configured');
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['Mohs-agent', 'Chrome', '1.0.0'],
    });

    // Handle connection update (includes QR code)
    this.sock.ev.on('connection.update', ({ qr, connection, lastDisconnect }) => {
      if (qr) {
        console.log('[WhatsAppChannel] QR Code received. Scan with WhatsApp app:');
        console.log(qr);
        if (this.qrCallback) {
          this.qrCallback(qr);
        }
      }

      if (connection === 'open') {
        this.isConnected = true;
        this.status = { connected: true, authenticated: true };
        console.log('[WhatsAppChannel] Connected to WhatsApp');
      } else if (connection === 'close') {
        this.isConnected = false;
        const logout = lastDisconnect?.error as Boom | undefined;
        if (logout?.output?.statusCode !== DisconnectReason.loggedOut) {
          console.log('[WhatsAppChannel] Connection closed, will reconnect...');
        } else {
          this.status = { connected: false, authenticated: false };
          console.log('[WhatsAppChannel] Logged out from WhatsApp');
        }
      }
    });

    // Handle incoming messages
    this.sock.ev.on('messages.upsert', async ({ messages }) => {
      if (!this.messageHandler) return;

      for (const msg of messages) {
        // Skip own messages and status broadcasts
        if (!msg.message || msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') {
          continue;
        }

        const content = msg.message.conversation ||
                        msg.message.extendedTextMessage?.text ||
                        msg.message.imageMessage?.caption ||
                        '';

        if (!content) continue;

        const jid = msg.key.remoteJid!;
        const senderId = msg.key.participant || jid;

        const inboundMessage: InboundMessage = {
          id: `wa-${msg.key.id}`,
          channelId: this.id,
          peerId: jid,
          senderId: senderId,
          senderName: senderId.split('@')[0],
          content: content,
          timestamp: typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now(),
          raw: msg,
        };

        await this.messageHandler(inboundMessage);
      }
    });

    // Save credentials when updated
    this.sock.ev.on('creds.update', saveCreds);

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 60000);

      const checkConnection = ({ connection }: { connection?: string }) => {
        if (connection === 'open') {
          clearTimeout(timeout);
          resolve();
        }
      };

      this.sock!.ev.on('connection.update', checkConnection);
    });

    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      await this.sock.logout();
      this.sock.end(undefined);
      this.sock = undefined;
    }
    this.isConnected = false;
    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    if (!this.sock || !this.isConnected) {
      throw new Error('WhatsApp not connected');
    }

    try {
      const jid = message.to.includes('@') ? message.to : `${message.to}@s.whatsapp.net`;
      const content: AnyMessageContent = { text: message.content };

      if (message.replyTo) {
        content.contextInfo = { stanzaId: message.replyTo };
      }

      const result = await this.sock.sendMessage(jid, content);
      const msgId = result.key?.id || `wa-${Date.now()}`;
      return `wa-${msgId}`;
    } catch (error) {
      console.error('[WhatsAppChannel] Send error:', error);
      throw error;
    }
  }

  async sendTyping(peerId: string): Promise<void> {
    if (!this.sock || !this.isConnected) {
      return;
    }

    try {
      const jid = peerId.includes('@') ? peerId : `${peerId}@s.whatsapp.net`;
      await this.sock.sendPresenceUpdate('composing', jid);
    } catch {
      // Ignore typing indicator errors
    }
  }

  /**
   * Set QR code callback for UI integration
   */
  onQRCode(callback: (qr: string) => void): void {
    this.qrCallback = callback;
  }
}
