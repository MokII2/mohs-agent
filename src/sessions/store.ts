/**
 * Session Types
 *
 * Type definitions for session management.
 */

import type { SessionId } from '../types/index.js';

/**
 * Session metadata
 */
export interface SessionMetadata {
  userId?: string;
  userName?: string;
  workspacePath?: string;
  agentId?: string;
  channelId?: string;
  tags?: string[];
  origin?: string;
  createdBy?: string;
}

/**
 * Transcript entry
 */
export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  agentId?: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Session
 */
export interface Session {
  id: SessionId;
  key: string;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  metadata: SessionMetadata;
  context: Record<string, unknown>;
  transcript: TranscriptEntry[];
  model?: string;
  modelProvider?: string;
  status: SessionStatus;
}

/**
 * Session status
 */
export type SessionStatus = 'active' | 'idle' | 'completed' | 'error';

/**
 * Session filter
 */
export interface SessionFilter {
  since?: number;
  until?: number;
  userId?: string;
  agentId?: string;
  channelId?: string;
  status?: SessionStatus;
  tags?: string[];
  limit?: number;
}

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  key?: string;
  metadata?: SessionMetadata;
  context?: Record<string, unknown>;
  model?: string;
  modelProvider?: string;
}

/**
 * Session update options
 */
export interface UpdateSessionOptions {
  metadata?: Partial<SessionMetadata>;
  context?: Record<string, unknown>;
  transcript?: TranscriptEntry[];
  model?: string;
  modelProvider?: string;
  status?: SessionStatus;
  lastActivityAt?: number;
}

/**
 * Session store interface
 */
export interface SessionStore {
  /**
   * Create a new session
   */
  create(options: CreateSessionOptions): Promise<Session>;

  /**
   * Get a session by ID
   */
  get(id: SessionId): Promise<Session | undefined>;

  /**
   * Get a session by key
   */
  getByKey(key: string): Promise<Session | undefined>;

  /**
   * Update a session
   */
  update(id: SessionId, updates: UpdateSessionOptions): Promise<Session>;

  /**
   * Delete a session
   */
  delete(id: SessionId): Promise<void>;

  /**
   * List sessions with optional filter
   */
  list(filter?: SessionFilter): Promise<Session[]>;

  /**
   * Check if a session exists
   */
  has(id: SessionId): Promise<boolean>;

  /**
   * Get session count
   */
  count(filter?: SessionFilter): Promise<number>;
}

/**
 * Session lifecycle event types
 */
export type SessionLifecycleEventType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'activated'
  | 'idle'
  | 'completed'
  | 'error';

/**
 * Session lifecycle event
 */
export interface SessionLifecycleEvent {
  type: SessionLifecycleEventType;
  session: Session;
  timestamp: number;
  data?: Record<string, unknown>;
}

/**
 * Session lifecycle listener
 */
export type SessionLifecycleListener = (event: SessionLifecycleEvent) => void | Promise<void>;
