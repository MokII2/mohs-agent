/**
 * Hook Types
 *
 * Type definitions for the hook system.
 */

/**
 * Hook event types
 */
export type HookEventType =
  | 'command:before'
  | 'command:after'
  | 'command:error'
  | 'session:start'
  | 'session:end'
  | 'session:resume'
  | 'session:reset'
  | 'agent:start'
  | 'agent:stop'
  | 'agent:error'
  | 'gateway:connect'
  | 'gateway:disconnect'
  | 'gateway:request'
  | 'message:receive'
  | 'message:send'
  | 'message:deliver'
  | 'task:submit'
  | 'task:complete'
  | 'task:fail'
  | 'task:cancel'
  | 'plugin:load'
  | 'plugin:unload'
  | 'plugin:error'
  | 'config:change'
  | 'security:audit';

/**
 * Hook event
 */
export interface HookEvent {
  id: string;
  type: HookEventType;
  source: string;
  timestamp: number;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Hook handler function
 */
export type HookHandler = (event: HookEvent) => Promise<void> | void;

/**
 * Hook source configuration
 */
export interface HookSource {
  name: string;
  enabled: boolean;
  priority: number;
  handlers: Map<HookEventType, Set<HookHandler>>;
}

/**
 * Hook configuration
 */
export interface HookEntry {
  name: string;
  enabled: boolean;
  events: HookEventType[];
  priority?: number;
}

/**
 * Hook enable state
 */
export type HookEnableState = 'enabled' | 'disabled' | 'default-on' | 'default-off' | 'explicit-opt-in';

/**
 * Hook precedence by source
 */
export const HOOK_SOURCE_PRECEDENCE: Record<string, number> = {
  'openclaw-bundled': 10,
  'openclaw-plugin': 20,
  'openclaw-managed': 30,
  'openclaw-workspace': 40,
};

/**
 * Create a hook event
 */
export function createHookEvent(
  type: HookEventType,
  source: string,
  data: Record<string, unknown> = {},
  metadata?: Record<string, unknown>
): HookEvent {
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    source,
    timestamp: Date.now(),
    data,
    metadata,
  };
}

/**
 * Check if event type matches a pattern
 */
export function matchesEventType(actual: HookEventType, pattern: HookEventType | HookEventType[]): boolean {
  if (Array.isArray(pattern)) {
    return pattern.includes(actual);
  }
  return actual === pattern;
}

/**
 * Get all event types as array
 */
export const ALL_HOOK_EVENT_TYPES: HookEventType[] = [
  'command:before',
  'command:after',
  'command:error',
  'session:start',
  'session:end',
  'session:resume',
  'session:reset',
  'agent:start',
  'agent:stop',
  'agent:error',
  'gateway:connect',
  'gateway:disconnect',
  'gateway:request',
  'message:receive',
  'message:send',
  'message:deliver',
  'task:submit',
  'task:complete',
  'task:fail',
  'task:cancel',
  'plugin:load',
  'plugin:unload',
  'plugin:error',
  'config:change',
  'security:audit',
];
