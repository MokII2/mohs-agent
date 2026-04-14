/**
 * ACP Client
 *
 * Client for connecting to a Gateway using ACP.
 */

import WebSocket from 'ws';
import type { Frame, ResponseFrame, EventFrame } from '../protocol/frames.js';
import { createRequestFrame, encode, decode } from '../protocol/index.js';

export interface ACPClientConfig {
  gatewayUrl: string;
  gatewayToken?: string;
  sessionId?: string;
  reconnect?: boolean;
  reconnectIntervalMs?: number;
}

type ACPClientEventHandler = (event: {
  type: 'connect' | 'disconnect' | 'error' | 'message';
  data?: unknown;
}) => void;

/**
 * ACP Client
 */
export class ACPClient {
  private ws?: WebSocket;
  private config: ACPClientConfig;
  private handlers: Set<ACPClientEventHandler> = new Set();
  private requestHandlers: Map<string, (response: ResponseFrame) => void> = new Map();
  private connected = false;
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: ACPClientConfig) {
    this.config = {
      reconnect: true,
      reconnectIntervalMs: 5000,
      ...config,
    };
  }

  /**
   * Connect to gateway
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.gatewayUrl);

      this.ws.on('open', () => {
        this.connected = true;
        this.emit({ type: 'connect' });

        // Send connect request
        const connectFrame = createRequestFrame('connect', {
          token: this.config.gatewayToken,
          sessionId: this.config.sessionId,
          protocolVersion: '1.0',
        });

        this.send(connectFrame);
        resolve();
      });

      this.ws.on('message', (data) => {
        const frame = decode(data.toString());
        if (!frame) return;

        if (frame.type === 'response' && frame.requestId) {
          // Handle response
          const handler = this.requestHandlers.get(frame.requestId);
          if (handler) {
            handler(frame as ResponseFrame);
            this.requestHandlers.delete(frame.requestId);
          }
        } else if (frame.type === 'event') {
          // Handle event
          this.emit({ type: 'message', data: frame });
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.emit({ type: 'disconnect' });
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        this.emit({ type: 'error', data: error });
        reject(error);
      });
    });
  }

  /**
   * Disconnect from gateway
   */
  disconnect(): void {
    this.clearReconnect();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = undefined;
    }
    this.connected = false;
  }

  /**
   * Send a request and wait for response
   */
  async request<T>(method: string, payload?: unknown, timeoutMs = 30000): Promise<T> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected');
    }

    const frame = createRequestFrame(method, payload);
    this.send(frame);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.requestHandlers.delete(frame.requestId);
        reject(new Error(`Request timeout: ${method}`));
      }, timeoutMs);

      this.requestHandlers.set(frame.requestId, (response) => {
        clearTimeout(timeout);
        if (response.status >= 200 && response.status < 300) {
          resolve(response.result as T);
        } else {
          reject(new Error(response.error?.message || `Request failed: ${response.status}`));
        }
      });
    });
  }

  /**
   * Send a frame without waiting for response
   */
  send(frame: Frame): void {
    if (this.ws && this.connected) {
      this.ws.send(encode(frame));
    }
  }

  /**
   * Subscribe to events
   */
  onEvent(handler: ACPClientEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Emit an event
   */
  private emit(event: { type: 'connect' | 'disconnect' | 'error' | 'message'; data?: unknown }): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Schedule reconnect attempt
   */
  private scheduleReconnect(): void {
    if (!this.config.reconnect) return;

    this.clearReconnect();

    this.reconnectTimer = setTimeout(() => {
      console.log('[ACPClient] Attempting reconnect...');
      this.connect().catch((error) => {
        console.error('[ACPClient] Reconnect failed:', error);
      });
    }, this.config.reconnectIntervalMs);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
