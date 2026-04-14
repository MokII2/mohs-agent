/**
 * Session Lifecycle
 *
 * Manages session lifecycle events.
 */

import type { Session, SessionLifecycleEvent, SessionLifecycleListener, SessionLifecycleEventType } from './store.js';

/**
 * Session Lifecycle Manager
 */
export class SessionLifecycle {
  private listeners: Set<SessionLifecycleListener> = new Set();
  private globalListeners: Set<SessionLifecycleListener> = new Set();

  /**
   * Register a listener for all events
   */
  onAny(listener: SessionLifecycleListener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  /**
   * Register a listener for specific event type
   */
  on(eventType: SessionLifecycleEventType, listener: SessionLifecycleListener): () => void {
    const wrappedListener = (event: SessionLifecycleEvent) => {
      if (event.type === eventType) {
        return listener(event);
      }
    };
    this.listeners.add(wrappedListener as SessionLifecycleListener);
    return () => this.listeners.delete(wrappedListener as SessionLifecycleListener);
  }

  /**
   * Emit a lifecycle event
   */
  async emit(event: SessionLifecycleEvent): Promise<void> {
    // Emit to specific listeners
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (error) {
        console.error(`[SessionLifecycle] Listener error for ${event.type}:`, error);
      }
    }

    // Emit to global listeners
    for (const listener of this.globalListeners) {
      try {
        await listener(event);
      } catch (error) {
        console.error(`[SessionLifecycle] Global listener error:`, error);
      }
    }
  }

  /**
   * Emit session created
   */
  async emitCreated(session: Session): Promise<void> {
    await this.emit({
      type: 'created',
      session,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit session updated
   */
  async emitUpdated(session: Session, data?: Record<string, unknown>): Promise<void> {
    await this.emit({
      type: 'updated',
      session,
      timestamp: Date.now(),
      data,
    });
  }

  /**
   * Emit session deleted
   */
  async emitDeleted(session: Session): Promise<void> {
    await this.emit({
      type: 'deleted',
      session,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit session activated
   */
  async emitActivated(session: Session): Promise<void> {
    await this.emit({
      type: 'activated',
      session,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit session idle
   */
  async emitIdle(session: Session): Promise<void> {
    await this.emit({
      type: 'idle',
      session,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit session completed
   */
  async emitCompleted(session: Session): Promise<void> {
    await this.emit({
      type: 'completed',
      session,
      timestamp: Date.now(),
    });
  }

  /**
   * Emit session error
   */
  async emitError(session: Session, error: string): Promise<void> {
    await this.emit({
      type: 'error',
      session,
      timestamp: Date.now(),
      data: { error },
    });
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.globalListeners.clear();
  }
}

// Global singleton
let globalLifecycle: SessionLifecycle | null = null;

export function getSessionLifecycle(): SessionLifecycle {
  if (!globalLifecycle) {
    globalLifecycle = new SessionLifecycle();
  }
  return globalLifecycle;
}
