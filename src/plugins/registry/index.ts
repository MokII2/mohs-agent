/**
 * Plugin Registry and Hook System
 *
 * Plugin architecture for extending the agent framework.
 * Based on OpenClaw's plugin system with hook-based integration.
 */

import type { PluginManifest, HookType, HookHandler, HookContext } from '../../types/index.js';

/**
 * Plugin interface
 */
export interface IPlugin {
  readonly manifest: PluginManifest;
  initialize(context: PluginContext): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Plugin context passed during initialization
 */
export interface PluginContext {
  agentId?: string;
  workspacePath?: string;
  config: Record<string, unknown>;
}

/**
 * Registered plugin
 */
interface RegisteredPlugin {
  plugin: IPlugin;
  manifest: PluginManifest;
  hooks: Map<HookType, HookHandler[]>;
}

/**
 * Plugin registry
 */
export class PluginRegistry {
  private plugins: Map<string, RegisteredPlugin> = new Map();
  private hookHandlers: Map<HookType, Set<HookHandler>> = new Map();

  // =========================================================================
  // Registration
  // =========================================================================

  /**
   * Register a plugin
   */
  async register(plugin: IPlugin): Promise<void> {
    const { name, version } = plugin.manifest;

    if (this.plugins.has(name)) {
      console.warn(`[PluginRegistry] Plugin ${name} already registered, replacing`);
      await this.unregister(name);
    }

    // Create registered plugin entry
    const registered: RegisteredPlugin = {
      plugin,
      manifest: plugin.manifest,
      hooks: new Map(),
    };

    // Register hooks from manifest
    if (plugin.manifest.hooks) {
      for (const hookType of plugin.manifest.hooks) {
        registered.hooks.set(hookType as HookType, []);
      }
    }

    this.plugins.set(name, registered);

    console.log(`[PluginRegistry] Registered plugin: ${name}@${version}`);
  }

  /**
   * Unregister a plugin
   */
  async unregister(name: string): Promise<boolean> {
    const registered = this.plugins.get(name);
    if (!registered) return false;

    // Shutdown plugin
    await registered.plugin.shutdown();

    // Remove hook handlers
    for (const handlers of registered.hooks.values()) {
      for (const handler of handlers) {
        this.removeHookHandler(handler);
      }
    }

    this.plugins.delete(name);
    console.log(`[PluginRegistry] Unregistered plugin: ${name}`);
    return true;
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): IPlugin | undefined {
    return this.plugins.get(name)?.plugin;
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values()).map((r) => r.plugin);
  }

  // =========================================================================
  // Hook System
  // =========================================================================

  /**
   * Register a hook handler for a plugin
   */
  registerHook(pluginName: string, hookType: HookType, handler: HookHandler): void {
    const registered = this.plugins.get(pluginName);
    if (!registered) {
      console.warn(`[PluginRegistry] Cannot register hook: plugin ${pluginName} not found`);
      return;
    }

    // Add to plugin's hooks
    if (!registered.hooks.has(hookType)) {
      registered.hooks.set(hookType, []);
    }
    registered.hooks.get(hookType)!.push(handler);

    // Also add to global handlers
    if (!this.hookHandlers.has(hookType)) {
      this.hookHandlers.set(hookType, new Set());
    }
    this.hookHandlers.get(hookType)!.add(handler);
  }

  /**
   * Remove a hook handler
   */
  private removeHookHandler(handler: HookHandler): void {
    for (const handlers of this.hookHandlers.values()) {
      handlers.delete(handler);
    }
  }

  /**
   * Trigger a hook
   *
   * Executes all registered handlers for the hook type.
   * Errors in handlers are caught and logged but don't stop other handlers.
   */
  async triggerHook(hookType: HookType, context: HookContext): Promise<void> {
    const handlers = this.hookHandlers.get(hookType);
    if (!handlers || handlers.size === 0) return;

    const errors: Array<{ plugin: string; error: unknown }> = [];

    for (const handler of handlers) {
      try {
        await handler(context);
      } catch (error) {
        errors.push({ plugin: 'unknown', error });
        console.error(`[PluginRegistry] Hook ${hookType} handler error:`, error);
      }
    }

    if (errors.length > 0) {
      console.warn(`[PluginRegistry] Hook ${hookType} had ${errors.length} errors`);
    }
  }

  /**
   * Trigger hook before agent starts
   */
  async beforeAgentStart(context: HookContext): Promise<void> {
    await this.triggerHook('beforeAgentStart', {
      ...context,
      hookType: 'beforeAgentStart',
    });
  }

  /**
   * Trigger hook after agent ends
   */
  async afterAgentEnd(context: HookContext): Promise<void> {
    await this.triggerHook('afterAgentEnd', {
      ...context,
      hookType: 'afterAgentEnd',
    });
  }

  /**
   * Trigger hook before tool call
   */
  async beforeToolCall(context: HookContext): Promise<void> {
    await this.triggerHook('beforeToolCall', {
      ...context,
      hookType: 'beforeToolCall',
    });
  }

  /**
   * Trigger hook after tool call
   */
  async afterToolCall(context: HookContext): Promise<void> {
    await this.triggerHook('afterToolCall', {
      ...context,
      hookType: 'afterToolCall',
    });
  }

  /**
   * Trigger hook on task complete
   */
  async onTaskComplete(context: HookContext): Promise<void> {
    await this.triggerHook('onTaskComplete', {
      ...context,
      hookType: 'onTaskComplete',
    });
  }

  /**
   * Trigger hook on task error
   */
  async onTaskError(context: HookContext): Promise<void> {
    await this.triggerHook('onTaskError', {
      ...context,
      hookType: 'onTaskError',
    });
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /**
   * Initialize all plugins
   */
  async initializeAll(context: PluginContext): Promise<void> {
    for (const registered of this.plugins.values()) {
      try {
        await registered.plugin.initialize(context);
        console.log(`[PluginRegistry] Initialized plugin: ${registered.manifest.name}`);
      } catch (error) {
        console.error(`[PluginRegistry] Failed to initialize ${registered.manifest.name}:`, error);
      }
    }
  }

  /**
   * Shutdown all plugins
   */
  async shutdownAll(): Promise<void> {
    for (const [name, registered] of this.plugins) {
      try {
        await registered.plugin.shutdown();
        console.log(`[PluginRegistry] Shutdown plugin: ${name}`);
      } catch (error) {
        console.error(`[PluginRegistry] Error shutting down ${name}:`, error);
      }
    }

    this.plugins.clear();
    this.hookHandlers.clear();
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  /**
   * Get plugin count
   */
  get count(): number {
    return this.plugins.size;
  }

  /**
   * Check if plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Get plugin manifest
   */
  getManifest(name: string): PluginManifest | undefined {
    return this.plugins.get(name)?.manifest;
  }
}

// Export singleton
export const pluginRegistry = new PluginRegistry();
