/**
 * WebChat Channel Adapter
 *
 * Simple WebSocket-based chat for web integration.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { BaseChannel } from '../base/index.js';
import type {
  ChannelConfig,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from '../base/types.js';

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  name?: string;
}

export class WebChatChannel extends BaseChannel {
  readonly id = 'webchat';
  readonly name = 'WebChat';
  readonly capabilities: ChannelCapabilities = {
    chatTypes: ['direct', 'group'],
    reactions: false,
    reply: true,
    media: false,
    mentions: false,
  };

  private server?: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private port?: number;

  async initialize(config: ChannelConfig & { port?: number }): Promise<void> {
    await super.initialize(config);
    this.port = config.port || 8080;
  }

  async connect(): Promise<void> {
    this.server = new WebSocketServer({ port: this.port });

    this.server.on('connection', (ws, req) => {
      const clientId = `wc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const clientName = new URL(req.url || '', `http://localhost:${this.port}`).searchParams.get('name') || 'Anonymous';

      this.clients.set(clientId, { id: clientId, ws, name: clientName });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'system',
        content: `Welcome, ${clientName}! Your ID: ${clientId}`,
      }));

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(clientId, message);
        } catch {
          // Ignore invalid JSON
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
      });
    });

    this.status = { connected: true, authenticated: true };
  }

  async disconnect(): Promise<void> {
    for (const client of this.clients.values()) {
      client.ws.close();
    }
    this.clients.clear();

    if (this.server) {
      this.server.close();
      this.server = undefined;
    }

    this.status = { connected: false, authenticated: false };
  }

  async send(message: OutboundMessage): Promise<string> {
    const client = this.clients.get(message.to);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Client not found or not connected');
    }

    const msgId = `msg-${Date.now()}`;
    client.ws.send(JSON.stringify({
      type: 'message',
      id: msgId,
      content: message.content,
      timestamp: Date.now(),
    }));

    return msgId;
  }

  async sendTyping(_peerId: string): Promise<void> {
    // WebSocket chat doesn't typically have typing indicators
  }

  /**
   * Broadcast to all connected clients
   */
  async broadcast(content: string): Promise<void> {
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'broadcast',
          content,
          timestamp: Date.now(),
        }));
      }
    }
  }

  private async handleWebSocketMessage(clientId: string, message: {
    type: string;
    content?: string;
    to?: string;
    replyTo?: string;
  }): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (message.type === 'message' && message.content) {
      const inboundMessage: InboundMessage = {
        id: `msg-${Date.now()}`,
        channelId: this.id,
        peerId: message.to || 'global',
        senderId: clientId,
        senderName: client.name,
        content: message.content,
        timestamp: Date.now(),
        raw: message,
      };

      await this.handleMessage(inboundMessage);

      // If direct message, send to recipient
      if (message.to) {
        const recipient = this.clients.get(message.to);
        if (recipient && recipient.ws.readyState === WebSocket.OPEN) {
          recipient.ws.send(JSON.stringify({
            type: 'message',
            id: inboundMessage.id,
            from: clientId,
            fromName: client.name,
            content: message.content,
            timestamp: Date.now(),
          }));
        }
      }
    }
  }
}
