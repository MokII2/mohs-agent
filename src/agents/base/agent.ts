/**
 * Base Agent Class
 *
 * Abstract base class for all agents in the framework.
 * Provides common functionality for task execution, lifecycle management,
 * and memory integration.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AgentId,
  IAgent,
  Task,
  TaskResult,
  ExecutionContext,
  AgentCapability,
  AgentStatus,
  Message,
  ToolCall,
} from '../../types/index.js';
import { createAgentId } from '../../types/index.js';

/**
 * Agent configuration
 */
export interface BaseAgentConfig {
  id?: AgentId;
  name: string;
  description?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  capabilities?: AgentCapability[];
}

/**
 * Abstract base agent
 */
export abstract class BaseAgent implements IAgent {
  readonly id: AgentId;
  readonly name: string;
  readonly description: string;
  readonly model?: string;
  readonly temperature: number;
  readonly maxTokens: number;

  private _status: AgentStatus = 'idle';
  private _systemPrompt: string;
  private _capabilities: AgentCapability[];
  private _executionHistory: Array<{
    taskId: string;
    timestamp: number;
    success: boolean;
  }> = [];

  constructor(config: BaseAgentConfig) {
    this.id = config.id ?? createAgentId(`agent-${uuidv4()}`);
    this.name = config.name;
    this.description = config.description ?? '';
    this.model = config.model;
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this._systemPrompt = config.systemPrompt ?? this.getDefaultSystemPrompt();
    this._capabilities = config.capabilities ?? this.getDefaultCapabilities();
  }

  // =========================================================================
  // IAgent Implementation
  // =========================================================================

  get status(): AgentStatus {
    return this._status;
  }

  getCapabilities(): AgentCapability[] {
    return this._capabilities;
  }

  getSystemPrompt(): string {
    return this._systemPrompt;
  }

  /**
   * Execute a task - must be implemented by subclasses
   */
  abstract execute(task: Task, context: ExecutionContext): Promise<TaskResult>;

  // =========================================================================
  // Lifecycle Methods (Template Method Pattern)
  // =========================================================================

  /**
   * Template method for task execution
   * Subclasses can override specific phases
   */
  protected async executeWithLifecycle(
    task: Task,
    context: ExecutionContext,
    executor: (task: Task, context: ExecutionContext) => Promise<TaskResult>
  ): Promise<TaskResult> {
    // Phase 1: Pre-execution hook
    await this.onBeforeExecute(task, context);

    this._status = 'running';

    try {
      // Phase 2: Execute
      const result = await executor(task, context);

      // Phase 3: Post-execution hooks
      await this.onAfterExecute(task, result, context);

      // Record in history
      this._executionHistory.push({
        taskId: task.id,
        timestamp: Date.now(),
        success: result.status === 'completed',
      });

      return result;
    } catch (error) {
      // Phase 3b: Error handling
      const errorResult = await this.onError(task, error, context);

      this._executionHistory.push({
        taskId: task.id,
        timestamp: Date.now(),
        success: false,
      });

      return errorResult;
    } finally {
      this._status = 'idle';
    }
  }

  /**
   * Called before task execution
   */
  protected async onBeforeExecute(
    task: Task,
    context: ExecutionContext
  ): Promise<void> {
    console.log(`[${this.name}] Starting task ${task.id}: ${task.description.substring(0, 50)}...`);
  }

  /**
   * Called after task execution
   */
  protected async onAfterExecute(
    task: Task,
    result: TaskResult,
    context: ExecutionContext
  ): Promise<void> {
    console.log(
      `[${this.name}] Completed task ${task.id}: ${result.status} ` +
        `(${result.executionTime ?? 0}ms)`
    );
  }

  /**
   * Called when execution throws an error
   */
  protected async onError(
    task: Task,
    error: unknown,
    context: ExecutionContext
  ): Promise<TaskResult> {
    console.error(`[${this.name}] Error in task ${task.id}:`, error);

    return {
      taskId: task.id,
      status: 'failed',
      error: {
        code: 'AGENT_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoverable: true,
      },
    };
  }

  // =========================================================================
  // Tool Integration
  // =========================================================================

  /**
   * Execute a tool call
   * Subclasses should override if they have custom tool handling
   */
  protected async executeToolCall(
    toolCall: ToolCall,
    context: ExecutionContext
  ): Promise<unknown> {
    if (!context.tools) {
      throw new Error('No tool registry available');
    }

    const result = await context.tools.execute(
      toolCall.name,
      toolCall.arguments,
      context
    );

    if (!result.success) {
      throw new Error(result.error ?? 'Tool execution failed');
    }

    return result.output;
  }

  // =========================================================================
  // Memory Integration
  // =========================================================================

  /**
   * Store message in sensory memory
   */
  protected async storeInSensoryMemory(
    message: Message,
    context: ExecutionContext
  ): Promise<void> {
    if (!context.memory) return;

    await context.memory.store('sensory', [
      {
        id: message.id,
        layer: 'sensory',
        content: message.content,
        timestamp: message.timestamp,
        agentId: this.id,
        sessionId: context.sessionId,
        metadata: { role: message.role },
        tags: [message.role],
      },
    ]);
  }

  /**
   * Store in working memory
   */
  protected async storeInWorkingMemory(
    content: string,
    context: ExecutionContext,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!context.memory) return;

    await context.memory.store('working', [
      {
        id: uuidv4(),
        layer: 'working',
        content,
        timestamp: Date.now(),
        agentId: this.id,
        sessionId: context.sessionId,
        metadata,
        tags: metadata?.tags as string[] | undefined,
      },
    ]);
  }

  // =========================================================================
  // Configuration
  // =========================================================================

  /**
   * Update system prompt
   */
  setSystemPrompt(prompt: string): void {
    this._systemPrompt = prompt;
  }

  /**
   * Append to system prompt
   */
  appendToSystemPrompt(additional: string): void {
    this._systemPrompt += '\n\n' + additional;
  }

  /**
   * Add capability
   */
  addCapability(capability: AgentCapability): void {
    this._capabilities.push(capability);
  }

  // =========================================================================
  // Statistics
  // =========================================================================

  /**
   * Get execution statistics
   */
  getStats(): AgentStats {
    const total = this._executionHistory.length;
    const successful = this._executionHistory.filter((h) => h.success).length;

    return {
      agentId: this.id,
      agentName: this.name,
      status: this._status,
      totalExecutions: total,
      successRate: total > 0 ? successful / total : 0,
      lastExecution: this._executionHistory[this._executionHistory.length - 1]?.timestamp,
    };
  }

  // =========================================================================
  // Abstract Methods
  // =========================================================================

  /**
   * Get default system prompt
   */
  protected abstract getDefaultSystemPrompt(): string;

  /**
   * Get default capabilities
   */
  protected abstract getDefaultCapabilities(): AgentCapability[];

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Parse tool call from LLM response
   */
  protected parseToolCalls(response: unknown): ToolCall[] {
    if (!response || typeof response !== 'object') return [];

    // Handle various LLM response formats
    const toolCalls: ToolCall[] = [];

    if (Array.isArray((response as Record<string, unknown>).tool_calls)) {
      const calls = (response as Record<string, unknown>).tool_calls as Array<Record<string, unknown>>;
      for (const call of calls) {
        toolCalls.push({
          id: (call.id as string) ?? uuidv4(),
          name: call.name as string ?? (call.function as Record<string, unknown>)?.name as string,
          arguments: typeof (call.function as Record<string, unknown>)?.arguments === 'string'
            ? JSON.parse((call.function as Record<string, unknown>).arguments as string)
            : (call.function as Record<string, unknown>)?.arguments as Record<string, unknown> ?? {},
        });
      }
    }

    return toolCalls;
  }

  /**
   * Build messages array for LLM
   */
  protected buildMessages(context: ExecutionContext): Message[] {
    const messages: Message[] = [];

    if (this._systemPrompt) {
      messages.push({
        id: uuidv4(),
        role: 'system',
        content: this._systemPrompt,
        timestamp: Date.now(),
      });
    }

    return messages;
  }
}

/**
 * Agent statistics
 */
export interface AgentStats {
  agentId: AgentId;
  agentName: string;
  status: AgentStatus;
  totalExecutions: number;
  successRate: number;
  lastExecution?: number;
}
