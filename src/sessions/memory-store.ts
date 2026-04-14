/**
 * Memory Session Store
 *
 * In-memory session store implementation.
 */

import { randomBytes } from 'crypto';
import type { SessionId } from '../types/index.js';
import type {
  Session,
  SessionStore,
  SessionFilter,
  CreateSessionOptions,
  UpdateSessionOptions,
  SessionMetadata,
} from './store.js';
import { SessionLifecycle, getSessionLifecycle } from './lifecycle.js';
import { parseSessionKey, createSessionKey } from './key-resolver.js';

function generateSessionId(): SessionId {
  return `sess_${randomBytes(16).toString('hex')}` as SessionId;
}

/**
 * In-memory session store
 */
export class MemorySessionStore implements SessionStore {
  private sessions: Map<SessionId, Session> = new Map();
  private keyIndex: Map<string, SessionId> = new Map();
  private lifecycle: SessionLifecycle;

  constructor(lifecycle?: SessionLifecycle) {
    this.lifecycle = lifecycle || getSessionLifecycle();
  }

  async create(options: CreateSessionOptions = {}): Promise<Session> {
    const id = generateSessionId();
    const now = Date.now();

    // Resolve key
    const key = options.key || createSessionKey({ sessionId: id });

    // Check for duplicate key
    if (this.keyIndex.has(key)) {
      throw new Error(`Session with key ${key} already exists`);
    }

    const metadata: SessionMetadata = {
      ...options.metadata,
    };

    const session: Session = {
      id,
      key,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      metadata,
      context: options.context || {},
      transcript: [],
      model: options.model,
      modelProvider: options.modelProvider,
      status: 'active',
    };

    this.sessions.set(id, session);
    this.keyIndex.set(key, id);

    await this.lifecycle.emitCreated(session);

    return session;
  }

  async get(id: SessionId): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getByKey(key: string): Promise<Session | undefined> {
    const id = this.keyIndex.get(key);
    if (!id) return undefined;
    return this.sessions.get(id);
  }

  async update(id: SessionId, updates: UpdateSessionOptions): Promise<Session> {
    const session = this.sessions.get(id);

    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    const updated: Session = {
      ...session,
      updatedAt: Date.now(),
      lastActivityAt: updates.lastActivityAt || Date.now(),
      metadata: updates.metadata ? { ...session.metadata, ...updates.metadata } : session.metadata,
      context: updates.context ? { ...session.context, ...updates.context } : session.context,
      transcript: updates.transcript || session.transcript,
      model: updates.model ?? session.model,
      modelProvider: updates.modelProvider ?? session.modelProvider,
      status: updates.status ?? session.status,
    };

    this.sessions.set(id, updated);
    await this.lifecycle.emitUpdated(session, updates as Record<string, unknown>);

    return updated;
  }

  async delete(id: SessionId): Promise<void> {
    const session = this.sessions.get(id);

    if (!session) {
      return; // Already deleted
    }

    this.sessions.delete(id);
    this.keyIndex.delete(session.key);

    await this.lifecycle.emitDeleted(session);
  }

  async list(filter: SessionFilter = {}): Promise<Session[]> {
    let sessions = Array.from(this.sessions.values());

    if (filter.since) {
      sessions = sessions.filter((s) => s.createdAt >= filter.since!);
    }

    if (filter.until) {
      sessions = sessions.filter((s) => s.createdAt <= filter.until!);
    }

    if (filter.userId) {
      sessions = sessions.filter((s) => s.metadata.userId === filter.userId);
    }

    if (filter.agentId) {
      sessions = sessions.filter((s) => s.metadata.agentId === filter.agentId);
    }

    if (filter.channelId) {
      sessions = sessions.filter((s) => s.metadata.channelId === filter.channelId);
    }

    if (filter.status) {
      sessions = sessions.filter((s) => s.status === filter.status);
    }

    if (filter.tags && filter.tags.length > 0) {
      sessions = sessions.filter((s) =>
        filter.tags!.some((tag) => s.metadata.tags?.includes(tag))
      );
    }

    // Sort by lastActivityAt descending
    sessions.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

    if (filter.limit) {
      sessions = sessions.slice(0, filter.limit);
    }

    return sessions;
  }

  async has(id: SessionId): Promise<boolean> {
    return this.sessions.has(id);
  }

  async count(filter: SessionFilter = {}): Promise<number> {
    const sessions = await this.list(filter);
    return sessions.length;
  }

  /**
   * Add a transcript entry to a session
   */
  async addTranscriptEntry(
    id: SessionId,
    entry: Omit<import('./store.js').TranscriptEntry, 'id' | 'timestamp'>
  ): Promise<Session> {
    const session = this.sessions.get(id);

    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    const fullEntry: import('./store.js').TranscriptEntry = {
      ...entry,
      id: `msg_${randomBytes(8).toString('hex')}`,
      timestamp: Date.now(),
    };

    return this.update(id, {
      transcript: [...session.transcript, fullEntry],
      lastActivityAt: Date.now(),
    });
  }

  /**
   * Clear all sessions (for testing)
   */
  async clear(): Promise<void> {
    for (const [id] of this.sessions) {
      await this.delete(id as SessionId);
    }
  }
}

// Singleton instance
let globalStore: MemorySessionStore | null = null;

export function getSessionStore(): MemorySessionStore {
  if (!globalStore) {
    globalStore = new MemorySessionStore();
  }
  return globalStore;
}
