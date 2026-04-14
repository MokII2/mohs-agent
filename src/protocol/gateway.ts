/**
 * Gateway
 *
 * WebSocket-based gateway server for agent control plane.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createMessageReader } from './codec.js';
import {
  Frame,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  createRequestFrame,
  createResponseFrame,
  createEventFrame,
  createErrorFrame,
  createSuccessFrame,
  GatewayMethod,
  GatewayEvent,
} from './frames.js';
import { negotiate, PROTOCOL_VERSION } from './negotiation.js';
import type { SessionStore } from '../sessions/index.js';
import type { HookDispatcher } from '../hooks/index.js';

export interface GatewayConfig {
  port: number;
  host?: string;
  requireAuth?: boolean;
  authToken?: string;
}

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  sessionId?: string;
  authenticated: boolean;
  version?: string;
  connectedAt: number;
  lastActivity: number;
}

/**
 * Request handler function
 */
type RequestHandler = (payload: unknown, client: ConnectedClient) => Promise<unknown>;

/**
 * Gateway server
 */
export class Gateway {
  private wss?: WebSocketServer;
  private clients: Map<string, ConnectedClient> = new Map();
  private clientIdCounter = 0;
  private requestHandlers: Map<string, RequestHandler> = new Map();
  private config: GatewayConfig;
  private sessionStore?: SessionStore;
  private hookDispatcher?: HookDispatcher;
  private sequenceNumber = 0;
  private running = false;

  constructor(
    config: GatewayConfig,
    sessionStore?: SessionStore,
    hookDispatcher?: HookDispatcher
  ) {
    this.config = config;
    this.sessionStore = sessionStore;
    this.hookDispatcher = hookDispatcher;

    // Register default handlers
    this.registerDefaultHandlers();
  }

  /**
   * Register a request handler
   */
  registerHandler(method: string, handler: RequestHandler): void {
    this.requestHandlers.set(method, handler);
  }

  /**
   * Start the gateway
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('[Gateway] Already running');
      return;
    }

    this.wss = new WebSocketServer({
      port: this.config.port,
      host: this.config.host,
    });

    this.wss.on('connection', (ws) => this.handleConnection(ws));

    this.wss.on('error', (error) => {
      console.error('[Gateway] Server error:', error);
    });

    this.running = true;
    console.log(`[Gateway] Started on ${this.config.host || '0.0.0.0'}:${this.config.port}`);
  }

  /**
   * Stop the gateway
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    // Close all client connections
    for (const [id, client] of this.clients) {
      try {
        client.ws.close(1000, 'Server shutting down');
      } catch {
        // Ignore close errors
      }
    }

    this.clients.clear();

    // Close server
    await new Promise<void>((resolve) => {
      this.wss?.close(() => resolve());
    });

    this.running = false;
    console.log('[Gateway] Stopped');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    const clientId = `client_${++this.clientIdCounter}`;
    const client: ConnectedClient = {
      id: clientId,
      ws,
      authenticated: false,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.clients.set(clientId, client);
    console.log(`[Gateway] Client connected: ${clientId}`);

    const reader = createMessageReader();

    ws.on('message', async (data) => {
      const frames = reader.feed(data.toString());

      for (const frame of frames) {
        await this.handleFrame(client, frame);
      }
    });

    ws.on('close', async () => {
      this.clients.delete(clientId);
      console.log(`[Gateway] Client disconnected: ${clientId}`);

      if (this.hookDispatcher) {
        await this.hookDispatcher.emitGatewayDisconnect(clientId);
      }
    });

    ws.on('error', (error) => {
      console.error(`[Gateway] Client ${clientId} error:`, error);
    });
  }

  /**
   * Handle a frame from a client
   */
  private async handleFrame(client: ConnectedClient, frame: Frame): Promise<void> {
    client.lastActivity = Date.now();

    switch (frame.type) {
      case 'request':
        await this.handleRequest(client, frame as RequestFrame);
        break;
      case 'response':
        // Handle responses (e.g., auth responses)
        await this.handleResponse(client, frame as ResponseFrame);
        break;
      case 'event':
        // Handle events from client
        await this.handleEvent(client, frame as EventFrame);
        break;
    }
  }

  /**
   * Handle request frame
   */
  private async handleRequest(client: ConnectedClient, frame: RequestFrame): Promise<void> {
    try {
      // Handle connect specially
      if (frame.method === 'connect') {
        await this.handleConnect(client, frame);
        return;
      }

      // Check authentication
      if (this.config.requireAuth && !client.authenticated && !frame.method.startsWith('auth.')) {
        const error = createErrorFrame(frame.requestId, 'AUTH_REQUIRED', 'Authentication required');
        client.ws.send(JSON.stringify(error));
        return;
      }

      // Find handler
      const handler = this.requestHandlers.get(frame.method);

      if (!handler) {
        const error = createErrorFrame(frame.requestId, 'METHOD_NOT_FOUND', `Unknown method: ${frame.method}`);
        client.ws.send(JSON.stringify(error));
        return;
      }

      // Execute handler
      const result = await handler(frame.payload, client);
      const response = createSuccessFrame(frame.requestId, result);
      client.ws.send(JSON.stringify(response));
    } catch (error) {
      const errorFrame = createErrorFrame(
        frame.requestId,
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : String(error)
      );
      client.ws.send(JSON.stringify(errorFrame));
    }
  }

  /**
   * Handle connect request
   */
  private async handleConnect(client: ConnectedClient, frame: RequestFrame): Promise<void> {
    const payload = frame.payload as {
      version?: string;
      minProtocol?: string;
      maxProtocol?: string;
      token?: string;
      client?: { id: string; version: string; platform: string };
    } | undefined;

    // Check auth token if required
    if (this.config.requireAuth) {
      const token = payload?.token || this.config.authToken;

      if (token !== this.config.authToken) {
        const error = createErrorFrame(frame.requestId, 'AUTH_FAILED', 'Invalid token');
        client.ws.send(JSON.stringify(error));
        client.ws.close(1008, 'Authentication failed');
        return;
      }

      client.authenticated = true;
    } else {
      client.authenticated = true;
    }

    // Negotiate protocol version
    const negotiation = negotiate(
      payload?.minProtocol || '1.0',
      payload?.maxProtocol || '1.0'
    );

    if (!negotiation.success) {
      const error = createErrorFrame(frame.requestId, 'PROTOCOL_MISMATCH', negotiation.error || 'Protocol version mismatch');
      client.ws.send(JSON.stringify(error));
      return;
    }

    client.version = negotiation.version;

    // Send hello
    const hello = createResponseFrame(frame.requestId, 200, {
      version: PROTOCOL_VERSION,
      sessionId: client.sessionId,
      serverTime: Date.now(),
    });
    client.ws.send(JSON.stringify(hello));

    // Emit connect event
    if (this.hookDispatcher) {
      await this.hookDispatcher.emitGatewayConnect(client.id);
    }
  }

  /**
   * Handle response frame
   */
  private async handleResponse(client: ConnectedClient, frame: ResponseFrame): Promise<void> {
    // Handle auth responses, etc.
    console.log(`[Gateway] Response from ${client.id}: ${frame.status}`);
  }

  /**
   * Handle event frame
   */
  private async handleEvent(client: ConnectedClient, frame: EventFrame): Promise<void> {
    console.log(`[Gateway] Event from ${client.id}: ${frame.event}`);
  }

  /**
   * Broadcast an event to all clients
   */
  async broadcast(event: string, payload?: unknown): Promise<void> {
    const frame = createEventFrame(event, payload, ++this.sequenceNumber);
    const message = JSON.stringify(frame);

    for (const [, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  /**
   * Send to a specific client
   */
  async sendTo(clientId: string, frame: Frame): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    if (client.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Client ${clientId} not connected`);
    }

    client.ws.send(JSON.stringify(frame));
  }

  /**
   * Register default handlers
   */
  private registerDefaultHandlers(): void {
    // Ping handler
    this.registerHandler('ping', async () => ({ pong: Date.now() }));

    // Session handlers
    this.registerHandler('session.list', async (_, client) => {
      if (!this.sessionStore) return [];
      return this.sessionStore.list({ limit: 100 });
    });

    // Config handlers
    this.registerHandler('config.get', async () => {
      // Return non-sensitive config
      return { version: PROTOCOL_VERSION };
    });
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }
}
