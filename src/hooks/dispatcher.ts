/**
 * Hook Dispatcher
 *
 * Dispatches hook events to registered handlers.
 */

import type { HookEvent, HookEventType } from './types.js';
import { createHookEvent } from './types.js';
import { HookRegistry, getHookRegistry } from './registry.js';

/**
 * Hook Dispatcher
 */
export class HookDispatcher {
  private registry: HookRegistry;
  private strictMode: boolean;

  constructor(registry?: HookRegistry) {
    this.registry = registry || getHookRegistry();
    this.strictMode = false;
  }

  /**
   * Dispatch a hook event
   */
  async dispatch(event: HookEvent): Promise<void> {
    const handlers = this.registry.getHandlers(event.type);

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`[HookDispatcher] Handler error for ${event.type} from ${event.source}:`, error);

        if (this.strictMode) {
          throw error;
        }
      }
    }
  }

  /**
   * Dispatch an event by type
   */
  async dispatchEvent(
    type: HookEventType,
    source: string,
    data: Record<string, unknown> = {},
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event = createHookEvent(type, source, data, metadata);
    await this.dispatch(event);
  }

  /**
   * Set strict mode (throw on handler error)
   */
  setStrictMode(enabled: boolean): void {
    this.strictMode = enabled;
  }

  // Convenience methods for common events

  /**
   * Emit command before event
   */
  async emitCommandBefore(command: string, args: Record<string, unknown>): Promise<void> {
    await this.dispatchEvent('command:before', 'system', { command, args });
  }

  /**
   * Emit command after event
   */
  async emitCommandAfter(command: string, args: Record<string, unknown>, result: unknown): Promise<void> {
    await this.dispatchEvent('command:after', 'system', { command, args, result });
  }

  /**
   * Emit command error event
   */
  async emitCommandError(command: string, args: Record<string, unknown>, error: string): Promise<void> {
    await this.dispatchEvent('command:error', 'system', { command, args, error });
  }

  /**
   * Emit session start event
   */
  async emitSessionStart(sessionId: string, context: Record<string, unknown>): Promise<void> {
    await this.dispatchEvent('session:start', 'system', { sessionId, context });
  }

  /**
   * Emit session end event
   */
  async emitSessionEnd(sessionId: string, context: Record<string, unknown>): Promise<void> {
    await this.dispatchEvent('session:end', 'system', { sessionId, context });
  }

  /**
   * Emit message receive event
   */
  async emitMessageReceive(messageId: string, content: string, from: string): Promise<void> {
    await this.dispatchEvent('message:receive', 'system', { messageId, content, from });
  }

  /**
   * Emit message send event
   */
  async emitMessageSend(messageId: string, content: string, to: string): Promise<void> {
    await this.dispatchEvent('message:send', 'system', { messageId, content, to });
  }

  /**
   * Emit agent start event
   */
  async emitAgentStart(agentId: string, config: Record<string, unknown>): Promise<void> {
    await this.dispatchEvent('agent:start', 'system', { agentId, config });
  }

  /**
   * Emit agent stop event
   */
  async emitAgentStop(agentId: string): Promise<void> {
    await this.dispatchEvent('agent:stop', 'system', { agentId });
  }

  /**
   * Emit gateway connect event
   */
  async emitGatewayConnect(clientId: string): Promise<void> {
    await this.dispatchEvent('gateway:connect', 'gateway', { clientId });
  }

  /**
   * Emit gateway disconnect event
   */
  async emitGatewayDisconnect(clientId: string): Promise<void> {
    await this.dispatchEvent('gateway:disconnect', 'gateway', { clientId });
  }

  /**
   * Emit config change event
   */
  async emitConfigChange(path: string, oldValue: unknown, newValue: unknown): Promise<void> {
    await this.dispatchEvent('config:change', 'config', { path, oldValue, newValue });
  }

  /**
   * Emit security audit event
   */
  async emitSecurityAudit(action: string, result: string, details: Record<string, unknown>): Promise<void> {
    await this.dispatchEvent('security:audit', 'security', { action, result, details });
  }
}

// Global singleton
let globalDispatcher: HookDispatcher | null = null;

export function getHookDispatcher(): HookDispatcher {
  if (!globalDispatcher) {
    globalDispatcher = new HookDispatcher();
  }
  return globalDispatcher;
}
