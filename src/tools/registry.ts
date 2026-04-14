/**
 * Tool Registry
 *
 * Central registry for all tools. Follows the Hermes pattern:
 * - Tools self-register via module-level calls
 * - Tools are grouped into toolsets for easy enabling/disabling
 * - Tool schemas are used for validation and LLM function calling
 */

import type {
  ToolDefinition,
  ToolSchema,
  ToolResult,
  ExecutionContext,
  ToolHandler,
} from '../types/index.js';

/**
 * Tool registry implementation
 */
export class ToolRegistry {
  private readonly tools: Map<string, ToolDefinition> = new Map();
  private readonly toolsets: Map<string, Set<string>> = new Map();

  // Default toolsets
  private static readonly DEFAULT_TOOLSETS: Record<string, string[]> = {
    file: ['file_read', 'file_write', 'file_delete', 'file_list'],
    terminal: ['terminal', 'process'],
    web: ['web_search', 'web_fetch'],
    skills: ['skills_list', 'skill_view', 'skill_manage'],
    memory: ['memory_get', 'memory_store', 'memory_search'],
    agent: ['delegate', 'spawn_subagent'],
  };

  constructor() {
    // Initialize default toolsets
    for (const [name, toolNames] of Object.entries(ToolRegistry.DEFAULT_TOOLSETS)) {
      this.toolsets.set(name, new Set(toolNames));
    }
  }

  // =========================================================================
  // Registration
  // =========================================================================

  /**
   * Register a tool definition
   *
   * Typically called at module level for self-registration.
   */
  register(definition: ToolDefinition): void {
    const { name, toolset } = definition;

    this.tools.set(name, definition);

    // Add to toolset if specified
    if (toolset) {
      if (!this.toolsets.has(toolset)) {
        this.toolsets.set(toolset, new Set());
      }
      this.toolsets.get(toolset)!.add(name);
    }
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const definition = this.tools.get(name);
    if (!definition) return false;

    this.tools.delete(name);

    // Remove from all toolsets
    for (const toolSet of this.toolsets.values()) {
      toolSet.delete(name);
    }

    return true;
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool definition
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by toolset
   */
  getByToolset(toolset: string): ToolDefinition[] {
    const names = this.toolsets.get(toolset);
    if (!names) return [];
    return Array.from(names)
      .map((name) => this.tools.get(name))
      .filter((t): t is ToolDefinition => t !== undefined);
  }

  /**
   * Get all toolset names
   */
  getToolsets(): string[] {
    return Array.from(this.toolsets.keys());
  }

  // =========================================================================
  // Tool Execution
  // =========================================================================

  /**
   * Execute a tool by name
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const definition = this.tools.get(name);

    if (!definition) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
      };
    }

    // Check availability
    if (definition.checkFn && !definition.checkFn()) {
      return {
        success: false,
        error: `Tool '${name}' is not available`,
      };
    }

    // Check environment requirements
    if (definition.requiresEnv) {
      for (const envVar of definition.requiresEnv) {
        if (!process.env[envVar]) {
          return {
            success: false,
            error: `Tool '${name}' requires environment variable '${envVar}'`,
          };
        }
      }
    }

    try {
      const result = await definition.handler(args, context);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // =========================================================================
  // Schema Generation
  // =========================================================================

  /**
   * Generate JSON schema for all tools (for LLM function calling)
   */
  generateSchemas(): Record<string, ToolSchema> {
    const schemas: Record<string, ToolSchema> = {};

    for (const [name, definition] of this.tools) {
      // Check if tool is available
      if (definition.checkFn && !definition.checkFn()) {
        continue;
      }

      schemas[name] = definition.schema;
    }

    return schemas;
  }

  /**
   * Generate OpenAI-style function definitions
   */
  generateOpenAIFunctions(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: ToolSchema['parameters'];
    };
  }> {
    const functions: Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: ToolSchema['parameters'];
      };
    }> = [];

    for (const definition of this.tools.values()) {
      if (definition.checkFn && !definition.checkFn()) {
        continue;
      }

      functions.push({
        type: 'function',
        function: {
          name: definition.schema.name,
          description: definition.schema.description,
          parameters: definition.schema.parameters,
        },
      });
    }

    return functions;
  }
}

// Export singleton
export const toolRegistry = new ToolRegistry();

/**
 * Decorator for tool registration
 *
 * Usage:
 * ```typescript
 * @registerTool({
 *   name: 'my_tool',
 *   description: 'Does something useful',
 *   toolset: 'utilities'
 * })
 * async function myTool(args: Record<string, unknown>, context: ExecutionContext) {
 *   // implementation
 * }
 * ```
 */
export function registerTool(config: {
  name: string;
  description: string;
  toolset?: string;
  parameters?: ToolSchema['parameters'];
  requiresEnv?: string[];
  emoji?: string;
}) {
  return function <T extends ToolHandler>(handler: T): T {
    toolRegistry.register({
      name: config.name,
      toolset: config.toolset,
      schema: {
        name: config.name,
        description: config.description,
        parameters: config.parameters ?? { type: 'object', properties: {} },
      },
      handler,
      requiresEnv: config.requiresEnv,
      emoji: config.emoji,
    });
    return handler;
  };
}
