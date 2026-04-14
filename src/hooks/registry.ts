/**
 * Hook Registry
 *
 * Registry for hook handlers and sources.
 */

import type { HookEventType, HookHandler, HookSource, HookEntry } from './types.js';
import { HOOK_SOURCE_PRECEDENCE } from './types.js';

/**
 * Hook Registry
 */
export class HookRegistry {
  private sources: Map<string, HookSource> = new Map();
  private globalHandlers: Map<HookEventType, Set<HookHandler>> = new Map();

  /**
   * Register a hook source
   */
  registerSource(entry: HookEntry): void {
    const existing = this.sources.get(entry.name);

    if (existing) {
      // Update existing source
      existing.enabled = entry.enabled;
      existing.priority = entry.priority ?? HOOK_SOURCE_PRECEDENCE['openclaw-workspace'];
    } else {
      // Create new source
      this.sources.set(entry.name, {
        name: entry.name,
        enabled: entry.enabled,
        priority: entry.priority ?? HOOK_SOURCE_PRECEDENCE['openclaw-workspace'],
        handlers: new Map(),
      });
    }
  }

  /**
   * Unregister a hook source
   */
  unregisterSource(name: string): void {
    this.sources.delete(name);
  }

  /**
   * Register a handler for an event type from a source
   */
  register(sourceName: string, eventType: HookEventType, handler: HookHandler): void {
    let source = this.sources.get(sourceName);

    if (!source) {
      // Auto-create source if it doesn't exist
      source = {
        name: sourceName,
        enabled: true,
        priority: HOOK_SOURCE_PRECEDENCE['openclaw-workspace'],
        handlers: new Map(),
      };
      this.sources.set(sourceName, source);
    }

    if (!source.handlers.has(eventType)) {
      source.handlers.set(eventType, new Set());
    }

    source.handlers.get(eventType)!.add(handler);
  }

  /**
   * Unregister a handler
   */
  unregister(sourceName: string, eventType: HookEventType, handler: HookHandler): void {
    const source = this.sources.get(sourceName);
    if (!source) return;

    const handlers = source.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        source.handlers.delete(eventType);
      }
    }
  }

  /**
   * Unregister all handlers from a source
   */
  unregisterSourceHandlers(sourceName: string): void {
    const source = this.sources.get(sourceName);
    if (source) {
      source.handlers.clear();
    }
  }

  /**
   * Register a global handler (runs for all events)
   */
  registerGlobal(eventType: HookEventType, handler: HookHandler): void {
    if (!this.globalHandlers.has(eventType)) {
      this.globalHandlers.set(eventType, new Set());
    }
    this.globalHandlers.get(eventType)!.add(handler);
  }

  /**
   * Get handlers for an event type, sorted by priority
   */
  getHandlers(eventType: HookEventType): HookHandler[] {
    const handlers: Array<{ handler: HookHandler; priority: number }> = [];

    // Collect from global handlers
    const global = this.globalHandlers.get(eventType);
    if (global) {
      for (const handler of global) {
        handlers.push({ handler, priority: 0 }); // Global handlers run first
      }
    }

    // Collect from sources
    for (const source of this.sources.values()) {
      if (!source.enabled) continue;

      const sourceHandlers = source.handlers.get(eventType);
      if (sourceHandlers) {
        for (const handler of sourceHandlers) {
          handlers.push({ handler, priority: source.priority });
        }
      }
    }

    // Sort by priority (lower runs first)
    handlers.sort((a, b) => a.priority - b.priority);

    return handlers.map((h) => h.handler);
  }

  /**
   * Get all registered sources
   */
  getSources(): HookSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Get source by name
   */
  getSource(name: string): HookSource | undefined {
    return this.sources.get(name);
  }

  /**
   * Check if a source has handlers for an event
   */
  hasHandlers(sourceName: string, eventType: HookEventType): boolean {
    const source = this.sources.get(sourceName);
    if (!source || !source.enabled) return false;

    const handlers = source.handlers.get(eventType);
    return handlers !== undefined && handlers.size > 0;
  }

  /**
   * Enable/disable a source
   */
  setSourceEnabled(name: string, enabled: boolean): void {
    const source = this.sources.get(name);
    if (source) {
      source.enabled = enabled;
    }
  }

  /**
   * Clear all sources and handlers
   */
  clear(): void {
    this.sources.clear();
    this.globalHandlers.clear();
  }
}

// Global singleton
let globalRegistry: HookRegistry | null = null;

export function getHookRegistry(): HookRegistry {
  if (!globalRegistry) {
    globalRegistry = new HookRegistry();
  }
  return globalRegistry;
}
