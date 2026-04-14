/**
 * ACP Session
 *
 * ACP session management.
 */

import type { SessionId } from '../types/index.js';

/**
 * ACP session status
 */
export type ACPSessionStatus = 'pending' | 'active' | 'closed' | 'error';

/**
 * ACP session
 */
export interface ACPSession {
  id: string;
  gatewaySessionId?: SessionId;
  status: ACPSessionStatus;
  createdAt: number;
  lastActivityAt: number;
  cwd: string;
  metadata?: Record<string, unknown>;
}

/**
 * ACP session options
 */
export interface CreateACPSessionOptions {
  id?: string;
  gatewaySessionId?: SessionId;
  cwd?: string;
  metadata?: Record<string, unknown>;
}

/**
 * ACP session store
 */
export class ACPSessionStore {
  private sessions: Map<string, ACPSession> = new Map();

  /**
   * Create a new ACP session
   */
  create(options: CreateACPSessionOptions = {}): ACPSession {
    const session: ACPSession = {
      id: options.id || `acp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      gatewaySessionId: options.gatewaySessionId,
      status: 'pending',
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      cwd: options.cwd || process.cwd(),
      metadata: options.metadata,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get session by ID
   */
  get(id: string): ACPSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Update session
   */
  update(id: string, updates: Partial<ACPSession>): ACPSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    const updated: ACPSession = {
      ...session,
      ...updates,
      lastActivityAt: Date.now(),
    };

    this.sessions.set(id, updated);
    return updated;
  }

  /**
   * Close session
   */
  close(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    session.status = 'closed';
    session.lastActivityAt = Date.now();
    return true;
  }

  /**
   * Delete session
   */
  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  /**
   * List all sessions
   */
  list(): ACPSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get active sessions
   */
  getActive(): ACPSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active');
  }
}

/**
 * Global ACP session store
 */
let globalStore: ACPSessionStore | null = null;

export function getACPSessionStore(): ACPSessionStore {
  if (!globalStore) {
    globalStore = new ACPSessionStore();
  }
  return globalStore;
}
