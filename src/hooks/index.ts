/**
 * Hook System
 *
 * Event-driven hook system for extensibility.
 */

export { HookRegistry, getHookRegistry } from './registry.js';
export { HookDispatcher, getHookDispatcher } from './dispatcher.js';
export {
  HookEvent,
  HookEventType,
  HookHandler,
  HookSource,
  HookEntry,
  HookEnableState,
  ALL_HOOK_EVENT_TYPES,
  createHookEvent,
  matchesEventType,
} from './types.js';
