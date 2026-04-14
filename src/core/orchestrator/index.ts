/**
 * Central Orchestrator - Multi-Agent Coordination Hub
 *
 * The Orchestrator is the heart of Mohs-agent, upgrading from OpenClaw's
 * simple message forwarder to a true multi-agent coordination中枢.
 *
 * Architecture:
 * - Routes tasks to appropriate agents/subagents based on skill matching
 * - Manages agent lifecycle and health
 * - Coordinates memory operations across layers
 * - Triggers self-evolution processes
 * - Provides the execution context for all agents
 *
 * This replaces the traditional Central Gateway pattern with an intelligent
 * routing system inspired by Superpowers' subagent architecture.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  AgentId,
  Task,
  TaskId,
  TaskResult,
  TaskStatus,
  SessionId,
  ExecutionContext,
  RoutingDecision,
  IAgent,
  IMemoryClient,
  ISkillRegistry,
  IToolRegistry,
  SubagentDefinition,
  MemoryEntry,
  MemoryQuery,
  OrchestratorConfig,
} from '../../types/index.js';
import { createSessionId } from '../../types/index.js';
import { SubagentRouter } from '../router/subagent-router.js';
import { EvolutionEngine } from '../../evolution/evolution-engine.js';

/**
 * Orchestrator task queue entry
 */
interface QueuedTask {
  task: Task;
  priority: number;
  queuedAt: number;
  agentId?: AgentId;
}

/**
 * Agent registration in orchestrator
 */
interface RegisteredAgent {
  agent: IAgent;
  capabilities: string[];
  currentTasks: Set<TaskId>;
  maxConcurrent: number;
  status: 'available' | 'busy' | 'error' | 'offline';
  lastHeartbeat: number;
}

/**
 * Central Orchestrator class
 *
 * Coordinates all agent activities, manages task routing, and orchestrates
 * the self-evolution process.
 */
export class CentralOrchestrator {
  private readonly config: Required<OrchestratorConfig>;
  private readonly agents: Map<AgentId, RegisteredAgent> = new Map();
  private readonly subagentRouter: SubagentRouter;
  private readonly evolutionEngine: EvolutionEngine;
  private readonly taskQueue: Map<TaskId, QueuedTask> = new Map();
  private readonly activeTasks: Map<TaskId, Task> = new Map();

  // Default memory client placeholder (will be injected)
  private memoryClient?: IMemoryClient;
  private skillRegistry?: ISkillRegistry;
  private toolRegistry?: IToolRegistry;

  // Session management
  private readonly sessions: Map<SessionId, SessionContext> = new Map();

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      port: config.port ?? 8765,
      host: config.host ?? 'localhost',
      maxConcurrentTasks: config.maxConcurrentTasks ?? 10,
      taskTimeout: config.taskTimeout ?? 300000, // 5 minutes
      enableSelfEvolution: config.enableSelfEvolution ?? true,
      enableReflection: config.enableReflection ?? true,
      memoryConfig: config.memoryConfig ?? {
        enabledLayers: ['sensory', 'working', 'semantic', 'episodic', 'experience'],
      },
    };

    this.subagentRouter = new SubagentRouter();
    this.evolutionEngine = new EvolutionEngine({
      enableReflection: this.config.enableReflection,
      enableAutoSkillGen: this.config.enableSelfEvolution,
    });
  }

  // ===========================================================================
  // Agent Management
  // ===========================================================================

  /**
   * Register an agent with the orchestrator
   *
   * Architecture: Agents register with their capabilities, which are used
   * for intelligent task routing. The orchestrator maintains agent health
   * through heartbeat tracking.
   */
  registerAgent(agent: IAgent, options: { maxConcurrent?: number } = {}): void {
    const agentId = agent.id;
    const capabilities = agent.getCapabilities().map((c) => c.name);

    this.agents.set(agentId, {
      agent,
      capabilities,
      currentTasks: new Set(),
      maxConcurrent: options.maxConcurrent ?? 3,
      status: 'available',
      lastHeartbeat: Date.now(),
    });

    console.log(`[Orchestrator] Agent registered: ${agent.name} (${agentId})`);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: AgentId): boolean {
    const registered = this.agents.get(agentId);
    if (!registered) return false;

    // Cancel any running tasks
    for (const taskId of registered.currentTasks) {
      this.cancelTask(taskId);
    }

    this.agents.delete(agentId);
    console.log(`[Orchestrator] Agent unregistered: ${agentId}`);
    return true;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: AgentId): IAgent | undefined {
    return this.agents.get(agentId)?.agent;
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents(): IAgent[] {
    return Array.from(this.agents.values()).map((r) => r.agent);
  }

  /**
   * Update agent heartbeat
   */
  private updateHeartbeat(agentId: AgentId): void {
    const registered = this.agents.get(agentId);
    if (registered) {
      registered.lastHeartbeat = Date.now();
    }
  }

  // ===========================================================================
  // Task Routing & Execution
  // ===========================================================================

  /**
   * Submit a task to the orchestrator for execution
   *
   * This is the main entry point for task execution. The orchestrator:
   * 1. Analyzes the task to determine routing
   * 2. Matches against available skills
   * 3. Routes to appropriate agent/subagent
   * 4. Monitors execution and handles results
   */
  async submitTask(task: Task, context: ExecutionContext): Promise<TaskResult> {
    const taskId = task.id;

    // Check if task already exists
    if (this.activeTasks.has(taskId)) {
      return {
        taskId,
        status: 'running' as TaskStatus,
        error: {
          code: 'DUPLICATE_TASK',
          message: `Task ${taskId} is already being executed`,
          recoverable: false,
        },
      };
    }

    // Store task
    this.activeTasks.set(taskId, task);
    this.taskQueue.set(taskId, {
      task,
      priority: this.getTaskPriority(task),
      queuedAt: Date.now(),
    });

    try {
      // Step 1: Route the task to appropriate subagent
      const routingDecision = await this.routeTask(task, context);

      // Step 2: Select and acquire agent
      const agent = await this.selectAgent(routingDecision, context);

      // Step 3: Execute the task
      const result = await this.executeWithAgent(agent, task, routingDecision, context);

      // Step 4: Process completion (evolution, reflection)
      await this.processTaskCompletion(task, result, context);

      return result;
    } catch (error) {
      const errorResult: TaskResult = {
        taskId,
        status: 'failed',
        error: {
          code: 'ORCHESTRATOR_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
        },
      };
      return errorResult;
    } finally {
      this.activeTasks.delete(taskId);
      this.taskQueue.delete(taskId);
    }
  }

  /**
   * Route task to appropriate subagent based on skill matching
   *
   * This implements the Superpowers-inspired subagent routing pattern.
   * Tasks are analyzed and matched against registered skills to determine
   * the most appropriate subagent type.
   */
  private async routeTask(task: Task, context: ExecutionContext): Promise<RoutingDecision> {
    // Use the subagent router to make routing decision
    const skillMatches = context.skills
      ? await context.skills.search(task.description)
      : [];

    const routingDecision = this.subagentRouter.route(task, skillMatches);

    console.log(
      `[Orchestrator] Task ${task.id} routed to ${routingDecision.subagentType} ` +
        `(confidence: ${routingDecision.confidence.toFixed(2)})`
    );

    return routingDecision;
  }

  /**
   * Select the best agent for the task based on routing decision
   */
  private async selectAgent(
    routingDecision: RoutingDecision,
    context: ExecutionContext
  ): Promise<IAgent> {
    // Find available agent with matching capabilities
    const availableAgents = Array.from(this.agents.values())
      .filter((r) => r.status === 'available' && r.currentTasks.size < r.maxConcurrent)
      .sort((a, b) => a.currentTasks.size - b.currentTasks.size);

    if (availableAgents.length === 0) {
      // Create or get default agent
      const defaultAgent = this.getOrCreateDefaultAgent();
      return defaultAgent;
    }

    // Prefer agents with matching capabilities
    const matchingAgent = availableAgents.find((r) =>
      routingDecision.matchedSkills.some((match) =>
        r.capabilities.includes(match.skill.id as unknown as string)
      )
    );

    return matchingAgent?.agent ?? availableAgents[0].agent;
  }

  /**
   * Execute task with selected agent
   */
  private async executeWithAgent(
    agent: IAgent,
    task: Task,
    routingDecision: RoutingDecision,
    context: ExecutionContext
  ): Promise<TaskResult> {
    const agentId = agent.id;

    // Mark agent as busy
    const registered = this.agents.get(agentId);
    if (registered) {
      registered.currentTasks.add(task.id);
      registered.status = 'busy';
    }

    try {
      // Build enhanced context with routing info
      const enhancedContext: ExecutionContext = {
        ...context,
        config: {
          ...context.config,
          routingDecision,
          subagentType: routingDecision.subagentType,
        },
      };

      // Execute with timeout
      const result = await Promise.race([
        agent.execute(task, enhancedContext),
        this.createTimeout(this.config.taskTimeout),
      ]);

      // Update heartbeat
      this.updateHeartbeat(agentId);

      return result;
    } catch (error) {
      return {
        taskId: task.id,
        status: 'failed',
        error: {
          code: 'AGENT_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
          recoverable: true,
        },
      };
    } finally {
      // Release agent
      if (registered) {
        registered.currentTasks.delete(task.id);
        registered.status = 'available';
      }
    }
  }

  /**
   * Cancel a running task
   */
  cancelTask(taskId: TaskId): boolean {
    const queued = this.taskQueue.get(taskId);
    if (!queued) return false;

    const registered = Array.from(this.agents.values()).find((r) =>
      r.currentTasks.has(taskId)
    );

    if (registered) {
      registered.currentTasks.delete(taskId);
    }

    this.activeTasks.delete(taskId);
    this.taskQueue.delete(taskId);

    return true;
  }

  /**
   * Get current task status
   */
  getTaskStatus(taskId: TaskId): TaskStatus | undefined {
    if (this.activeTasks.has(taskId)) return 'running';
    const queued = this.taskQueue.get(taskId);
    if (queued) return 'pending';
    return undefined;
  }

  // ===========================================================================
  // Self-Evolution Integration
  // ===========================================================================

  /**
   * Process task completion - trigger reflection and evolution
   */
  private async processTaskCompletion(
    task: Task,
    result: TaskResult,
    context: ExecutionContext
  ): Promise<void> {
    if (!this.config.enableSelfEvolution) return;

    // Record experience in memory
    if (this.memoryClient && context.sessionId) {
      const experienceEntry: MemoryEntry = {
        id: uuidv4(),
        layer: 'experience',
        content: JSON.stringify({
          taskId: task.id,
          taskType: task.type,
          success: result.status === 'completed',
          outcome: result.output ?? result.error,
        }),
        timestamp: Date.now(),
        agentId: context.sessionId as unknown as AgentId,
        sessionId: context.sessionId,
        metadata: {
          taskType: task.type,
          success: result.status === 'completed',
        },
        tags: [task.type],
      };

      await this.memoryClient.store('experience', [experienceEntry]);
    }

    // Trigger evolution engine for reflection
    if (result.status === 'completed' && result.reflections) {
      for (const reflection of result.reflections) {
        await this.evolutionEngine.processReflection(reflection, context);
      }
    }

    // Trial and error learning - if task failed, record for improvement
    if (result.status === 'failed' && result.error) {
      await this.evolutionEngine.recordFailure(task, result.error, context);
    }
  }

  // ===========================================================================
  // Session Management
  // ===========================================================================

  /**
   * Create or get existing session
   */
  getOrCreateSession(sessionId?: SessionId): SessionContext {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const id = sessionId ?? createSessionId(uuidv4());
    const session: SessionContext = {
      id,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      taskCount: 0,
    };

    this.sessions.set(id, session);
    return session;
  }

  /**
   * Get session context
   */
  getSession(sessionId: SessionId): SessionContext | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session activity
   */
  updateSession(sessionId: SessionId): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      session.messageCount++;
    }
  }

  // ===========================================================================
  // Memory Operations
  // ===========================================================================

  /**
   * Set memory client
   */
  setMemoryClient(client: IMemoryClient): void {
    this.memoryClient = client;
  }

  /**
   * Set skill registry
   */
  setSkillRegistry(registry: ISkillRegistry): void {
    this.skillRegistry = registry;
    this.subagentRouter.setSkillRegistry(registry);
  }

  /**
   * Set tool registry
   */
  setToolRegistry(registry: IToolRegistry): void {
    this.toolRegistry = registry;
  }

  /**
   * Query memory across layers
   */
  async queryMemory(query: MemoryQuery): Promise<MemoryEntry[]> {
    if (!this.memoryClient) return [];
    return this.memoryClient.retrieve(query);
  }

  /**
   * Store memory entries
   */
  async storeMemory(entries: MemoryEntry[]): Promise<void> {
    if (!this.memoryClient) return;
    await this.memoryClient.store(entries[0]?.layer ?? 'sensory', entries);
  }

  // ===========================================================================
  // Subagent Registration
  // ===========================================================================

  /**
   * Register a subagent type for routing
   */
  registerSubagent(definition: SubagentDefinition): void {
    this.subagentRouter.registerSubagent(definition);
  }

  /**
   * Get all registered subagent types
   */
  getSubagentTypes(): SubagentDefinition[] {
    return this.subagentRouter.getAllSubagents();
  }

  // ===========================================================================
  // Health & Status
  // ===========================================================================

  /**
   * Get orchestrator health status
   */
  getHealth(): OrchestratorHealth {
    const agents = Array.from(this.agents.values());
    return {
      status: agents.some((a) => a.status === 'error') ? 'degraded' : 'healthy',
      activeAgents: agents.filter((a) => a.status !== 'offline').length,
      totalAgents: this.agents.size,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.taskQueue.size,
      uptime: Date.now() - (this.startTime ?? Date.now()),
    };
  }

  /**
   * Start time for uptime calculation
   */
  private startTime?: number;

  /**
   * Start the orchestrator
   */
  start(): void {
    this.startTime = Date.now();
    console.log(
      `[Orchestrator] Started on ${this.config.host}:${this.config.port}`
    );
  }

  /**
   * Stop the orchestrator
   */
  stop(): void {
    // Cancel all pending tasks
    for (const taskId of this.activeTasks.keys()) {
      this.cancelTask(taskId);
    }

    // Shutdown all agents
    for (const [agentId] of this.agents) {
      this.unregisterAgent(agentId);
    }

    console.log('[Orchestrator] Stopped');
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Calculate task priority
   */
  private getTaskPriority(task: Task): number {
    const priorityWeights = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1,
    };
    return priorityWeights[task.priority ?? 'normal'];
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Task timeout after ${ms}ms`)), ms)
    );
  }

  /**
   * Get or create default agent
   */
  private getOrCreateDefaultAgent(): IAgent {
    // Import here to avoid circular dependency
    const { DefaultAgent } = require('./default-agent.js');
    return new DefaultAgent();
  }
}

/**
 * Session context
 */
export interface SessionContext {
  id: SessionId;
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  taskCount: number;
}

/**
 * Orchestrator health status
 */
export interface OrchestratorHealth {
  status: 'healthy' | 'degraded' | 'critical';
  activeAgents: number;
  totalAgents: number;
  activeTasks: number;
  queuedTasks: number;
  uptime: number;
}

// Export singleton orchestrator
export const orchestrator = new CentralOrchestrator();
