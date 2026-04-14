/**
 * ACP Server
 *
 * ACP server implementation that bridges ACP to Gateway.
 */

import type { ACPClient } from './client.js';
import type { ACPSession, CreateACPSessionOptions } from './session.js';
import { ACPSessionStore, getACPSessionStore } from './session.js';
import type { Gateway } from '../protocol/gateway.js';
import type { ACPEvent } from './event-mapper.js';
import { mapACPToGateway } from './event-mapper.js';

export interface ACPServerConfig {
  gateway: Gateway;
}

/**
 * ACP server
 */
export class ACPServer {
  private config: ACPServerConfig;
  private sessionStore: ACPSessionStore;
  private clients: Map<string, ACPClient> = new Map();

  constructor(config: ACPServerConfig) {
    this.config = config;
    this.sessionStore = getACPSessionStore();
  }

  /**
   * Create an ACP session
   */
  createSession(options?: CreateACPSessionOptions): ACPSession {
    return this.sessionStore.create(options);
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): ACPSession | undefined {
    return this.sessionStore.get(id);
  }

  /**
   * Close a session
   */
  closeSession(id: string): boolean {
    return this.sessionStore.close(id);
  }

  /**
   * List all sessions
   */
  listSessions(): ACPSession[] {
    return this.sessionStore.list();
  }

  /**
   * Send event to a session
   */
  async sendEvent(sessionId: string, event: ACPEvent): Promise<void> {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const frame = mapACPToGateway(event, session.gatewaySessionId || (sessionId as any));
    await this.config.gateway.sendTo(sessionId, frame);
  }

  /**
   * Broadcast event to all sessions
   */
  async broadcastEvent(event: ACPEvent): Promise<void> {
    const sessions = this.sessionStore.list();

    for (const session of sessions) {
      await this.sendEvent(session.id, event);
    }
  }

  /**
   * Handle incoming ACP connection
   */
  handleConnection(client: ACPClient, options?: CreateACPSessionOptions): ACPSession {
    const session = this.sessionStore.create(options);
    this.clients.set(session.id, client);
    return session;
  }

  /**
   * Remove client connection
   */
  removeClient(sessionId: string): void {
    this.clients.delete(sessionId);
    this.sessionStore.close(sessionId);
  }

  /**
   * Get client for session
   */
  getClient(sessionId: string): ACPClient | undefined {
    return this.clients.get(sessionId);
  }

  /**
   * Check if server has active sessions
   */
  hasActiveSessions(): boolean {
    return this.sessionStore.getActive().length > 0;
  }
}
