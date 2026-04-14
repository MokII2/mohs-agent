/**
 * Mohs-agent Core Type Definitions
 *
 * This module defines the fundamental domain types for the agent framework.
 * Architecture rationale:
 * - Agent is the central abstraction - represents an autonomous entity
 * - Task represents unit of work with clear completion criteria
 * - Skill represents a reusable capability with markdown configuration
 * - Memory types follow the five-layer model from memory-context
 */

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * Unique identifier for agents
 */
export type AgentId = string & { readonly __brand: 'AgentId' };

/**
 * Unique identifier for tasks
 */
export type TaskId = string & { readonly __brand: 'TaskId' };

/**
 * Unique identifier for sessions
 */
export type SessionId = string & { readonly __brand: 'SessionId' };

/**
 * Unique identifier for skills
 */
export type SkillId = string & { readonly __brand: 'SkillId' };

/**
 * Message roles in conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Core message structure
 */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  sessionId?: SessionId;
  agentId?: AgentId;
  toolCalls?: ToolCall[];
  toolResultId?: string;
}

/**
 * Tool call representation
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Agent execution status
 */
export type AgentStatus = 'idle' | 'running' | 'waiting' | 'error' | 'stopped';

/**
 * Task status in execution pipeline
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

// ============================================================================
// Agent Types
// ============================================================================

/**
 * Agent capability definition
 */
export interface AgentCapability {
  name: string;
  description: string;
  version?: string;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  id: AgentId;
  name: string;
  description?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  capabilities?: AgentCapability[];
  memoryConfig?: MemoryConfig;
  skillIds?: SkillId[];
  metadata?: Record<string, unknown>;
}

/**
 * Base agent interface
 * All agents in the framework implement this interface
 */
export interface IAgent {
  readonly id: AgentId;
  readonly name: string;
  readonly status: AgentStatus;

  execute(task: Task, context: ExecutionContext): Promise<TaskResult>;
  getCapabilities(): AgentCapability[];
  getSystemPrompt(): string;
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * Task definition - unit of work for agents
 */
export interface Task {
  id: TaskId;
  type: string;
  description: string;
  input: TaskInput;
  priority?: TaskPriority;
  parentTaskId?: TaskId;
  subagentType?: string;
  skillId?: SkillId;
  context?: Record<string, unknown>;
  createdAt: number;
  expiresAt?: number;
}

/**
 * Task input - what the task needs to execute
 */
export interface TaskInput {
  query?: string;
  files?: string[];
  data?: Record<string, unknown>;
  constraints?: string[];
  expectedOutput?: string;
}

/**
 * Task result - output from task execution
 */
export interface TaskResult {
  taskId: TaskId;
  status: TaskStatus;
  output?: TaskOutput;
  error?: TaskError;
  executionTime?: number;
  steps?: TaskStep[];
  reflections?: Reflection[];
}

/**
 * Task output
 */
export interface TaskOutput {
  content?: string;
  data?: Record<string, unknown>;
  files?: string[];
  artifacts?: Artifact[];
}

/**
 * Task execution step for tracing
 */
export interface TaskStep {
  stepNumber: number;
  action: string;
  timestamp: number;
  input?: unknown;
  output?: unknown;
  subagentId?: AgentId;
  toolCalls?: ToolCall[];
}

/**
 * Artifact produced during execution
 */
export interface Artifact {
  type: string;
  name: string;
  content: string | Buffer;
  metadata?: Record<string, unknown>;
}

/**
 * Task execution error
 */
export interface TaskError {
  code: string;
  message: string;
  recoverable: boolean;
  retryable?: boolean;
  stack?: string;
}

/**
 * Execution context passed to agents
 */
export interface ExecutionContext {
  sessionId: SessionId;
  userId?: string;
  workspacePath?: string;
  memory?: IMemoryClient;
  skills?: ISkillRegistry;
  tools?: IToolRegistry;
  config?: Record<string, unknown>;
}

// ============================================================================
// Skill Types (from Superpowers)
// ============================================================================

/**
 * Skill frontmatter from SKILL.md
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  platforms?: string[];
  metadata?: {
    hermes?: {
      tags?: string[];
    };
    [key: string]: unknown;
  };
  prerequisites?: {
    commands?: string[];
    tools?: string[];
    skills?: string[];
  };
  whenToUse?: string;
  rules?: string[];
}

/**
 * Parsed skill document
 */
export interface Skill {
  id: SkillId;
  path: string;
  frontmatter: SkillFrontmatter;
  content: string;
  sections: SkillSection[];
  createdAt: number;
  updatedAt: number;
  isDynamic?: boolean;
}

/**
 * Section in skill document
 */
export interface SkillSection {
  name: string;
  level: number;
  content: string;
}

/**
 * Skill match result
 */
export interface SkillMatch {
  skill: Skill;
  relevanceScore: number;
  matchedOn: 'description' | 'content' | 'tags' | 'metadata';
}

// ============================================================================
// Memory Types (from memory-context five-layer model)
// ============================================================================

/**
 * Memory layer types
 */
export type MemoryLayerType = 'sensory' | 'working' | 'semantic' | 'episodic' | 'experience';

/**
 * Memory layer interface
 */
export interface IMemoryLayer {
  readonly type: MemoryLayerType;
  readonly agentId: AgentId;

  initialize(): Promise<void>;
  store(entries: MemoryEntry[]): Promise<void>;
  retrieve(query: MemoryQuery): Promise<MemoryEntry[]>;
  clear?(): Promise<void>;
}

/**
 * Memory entry
 */
export interface MemoryEntry {
  id: string;
  layer: MemoryLayerType;
  content: string;
  timestamp: number;
  agentId: AgentId;
  sessionId?: SessionId;
  metadata?: Record<string, unknown>;
  tags?: string[];
  contentHash?: string;
}

/**
 * Memory query
 */
export interface MemoryQuery {
  query?: string;
  layer?: MemoryLayerType;
  topK?: number;
  agentId?: AgentId;
  sessionId?: SessionId;
  since?: number;
  until?: number;
  tags?: string[];
  limit?: number;
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  enabledLayers: MemoryLayerType[];
  chromaPath?: string;
  embeddingModel?: string;
  retentionPolicy?: RetentionPolicy;
}

/**
 * Retention policy for memory layers
 */
export interface RetentionPolicy {
  sensoryDays?: number;
  workingMaxEntries?: number;
  semanticDays?: number;
  episodicMonths?: number;
  experienceMaxEntries?: number;
  experienceDays?: number;
}

// ============================================================================
// Five-Layer Memory Specific Types
// ============================================================================

/**
 * Sensory memory - raw conversation input
 * Retention: 183 days
 */
export interface SensoryEntry extends MemoryEntry {
  layer: 'sensory';
  sessionId: SessionId;
  role: MessageRole;
  contentHash: string;
}

/**
 * Working memory - current task context
 * Retention: 20 most recent messages, 7 days
 */
export interface WorkingEntry extends MemoryEntry {
  layer: 'working';
  taskId?: TaskId;
  isActive: boolean;
}

/**
 * Semantic memory - compressed knowledge (ChromaDB)
 * Retention: Persistent with compression
 */
export interface SemanticEntry extends MemoryEntry {
  layer: 'semantic';
  embedding?: number[];
  collectionName: string;
  sourceType: 'sensory_compression' | 'skill' | 'knowledge';
}

/**
 * Episodic memory - monthly conversation archives
 * Retention: 12 months
 */
export interface EpisodicEntry extends MemoryEntry {
  layer: 'episodic';
  monthKey: string; // YYYY-MM format
  messageCount: number;
}

/**
 * Experience memory - trial/error outcomes
 * Retention: 500 entries max, 90 days
 */
export interface ExperienceEntry extends MemoryEntry {
  layer: 'experience';
  type: 'error' | 'practice' | 'lesson';
  title: string;
  lesson: string;
  keywords: string[];
  success: boolean;
}

// ============================================================================
// Evolution Types (from Hermes)
// ============================================================================

/**
 * Reflection result from self-review
 */
export interface Reflection {
  id: string;
  taskId: TaskId;
  timestamp: number;
  type: 'skill_suggestion' | 'error_learned' | 'approach_improvement';
  content: string;
  confidence: number;
  autoGenerated?: boolean;
}

/**
 * Experience record for learning
 */
export interface ExperienceRecord {
  id: string;
  taskId: TaskId;
  type: 'success' | 'failure' | 'partial';
  approach: string;
  outcome: string;
  lessons: string[];
  keywords: string[];
  timestamp: number;
  success: boolean;
}

/**
 * Auto-generated skill draft
 */
export interface SkillDraft {
  frontmatter: SkillFrontmatter;
  content: string;
  sourceExperienceId?: string;
  confidence: number;
  generatedAt: number;
}

/**
 * Skill generation judgment
 */
export interface SkillJudgment {
  draftId: string;
  approved: boolean;
  feedback?: string;
  suggestedImprovements?: string[];
  judgedAt: number;
}

// ============================================================================
// Subagent Types (from Superpowers)
// ============================================================================

/**
 * Subagent definition
 */
export interface SubagentDefinition {
  type: string;
  name: string;
  description: string;
  systemPromptTemplate: string;
  skills?: SkillId[];
  tools?: string[];
  isolationLevel: 'full' | 'partial' | 'shared';
}

/**
 * Subagent routing decision
 */
export interface RoutingDecision {
  subagentType: string;
  matchedSkills: SkillMatch[];
  confidence: number;
  reasoning: string;
}

/**
 * Context for subagent execution
 * Designed for context isolation (Superpowers principle)
 */
export interface SubagentContext {
  task: Task;
  relevantContext: string;
  workspacePath?: string;
  baseSha?: string;
  headSha?: string;
  // No session history - fresh context only
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * Tool schema definition
 */
export interface ToolSchema {
  name: string;
  description: string;
  parameters?: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
}

/**
 * Tool handler function
 */
export type ToolHandler = (
  args: Record<string, unknown>,
  context: ExecutionContext
) => Promise<ToolResult>;

/**
 * Tool result
 */
export interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

/**
 * Tool definition in registry
 */
export interface ToolDefinition {
  name: string;
  toolset?: string;
  schema: ToolSchema;
  handler: ToolHandler;
  checkFn?: () => boolean;
  requiresEnv?: string[];
  emoji?: string;
}

// ============================================================================
// Registry Interfaces
// ============================================================================

/**
 * Skill registry interface
 */
export interface ISkillRegistry {
  register(skill: Skill): void;
  unregister(skillId: SkillId): void;
  get(skillId: SkillId): Skill | undefined;
  findByName(name: string): Skill | undefined;
  search(query: string, topK?: number): Promise<SkillMatch[]>;
  getAll(): Skill[];
  getByTag(tag: string): Skill[];
}

/**
 * Tool registry interface
 */
export interface IToolRegistry {
  register(definition: ToolDefinition): void;
  unregister(name: string): void;
  get(name: string): ToolDefinition | undefined;
  getAll(): ToolDefinition[];
  getByToolset(toolset: string): ToolDefinition[];
  has(name: string): boolean;
  execute(name: string, args: Record<string, unknown>, context: ExecutionContext): Promise<ToolResult>;
}

/**
 * Memory client interface
 */
export interface IMemoryClient {
  readonly sensory: IMemoryLayer;
  readonly working: IMemoryLayer;
  readonly semantic: IMemoryLayer;
  readonly episodic: IMemoryLayer;
  readonly experience: IMemoryLayer;

  initialize(agentId: AgentId): Promise<void>;
  store(layer: MemoryLayerType, entries: MemoryEntry[]): Promise<void>;
  retrieve(query: MemoryQuery): Promise<MemoryEntry[]>;
  search(query: string, options?: { topK?: number; layers?: MemoryLayerType[] }): Promise<MemoryEntry[]>;
  clear(layer?: MemoryLayerType): Promise<void>;
}

// ============================================================================
// Orchestrator Types
// ============================================================================

/**
 * Orchestrator message types
 */
export type OrchestratorMessageType =
  | 'task:submit'
  | 'task:cancel'
  | 'task:status'
  | 'agent:register'
  | 'agent:unregister'
  | 'agent:execute'
  | 'memory:query'
  | 'memory:store'
  | 'skill:generate'
  | 'reflection:request';

/**
 * Orchestrator protocol message
 */
export interface OrchestratorMessage {
  id: string;
  type: OrchestratorMessageType;
  from: AgentId;
  to?: AgentId;
  payload: unknown;
  timestamp: number;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  port?: number;
  host?: string;
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  enableSelfEvolution?: boolean;
  enableReflection?: boolean;
  memoryConfig?: MemoryConfig;
}

// ============================================================================
// Plugin Types
// ============================================================================

/**
 * Plugin manifest
 */
export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: Record<string, string>;
  hooks?: string[];
  channels?: string[];
  tools?: string[];
  agents?: string[];
}

/**
 * Plugin hook types
 */
export type HookType =
  | 'beforeAgentStart'
  | 'afterAgentEnd'
  | 'beforeToolCall'
  | 'afterToolCall'
  | 'beforePromptBuild'
  | 'afterPromptBuild'
  | 'onTaskComplete'
  | 'onTaskError'
  | 'onSessionStart'
  | 'onSessionEnd';

/**
 * Plugin hook handler
 */
export type HookHandler = (context: HookContext) => Promise<void> | void;

/**
 * Hook context
 */
export interface HookContext {
  agentId?: AgentId;
  taskId?: TaskId;
  sessionId?: SessionId;
  hookType: HookType;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Export type guards and utilities
// ============================================================================

export function isTaskError(result: TaskResult): result is TaskResult & { error: TaskError } {
  return 'error' in result && result.error !== undefined;
}

export function isSuccessfulTask(result: TaskResult): boolean {
  return result.status === 'completed' && !isTaskError(result);
}

export function createAgentId(id: string): AgentId {
  return id as AgentId;
}

export function createTaskId(id: string): TaskId {
  return id as TaskId;
}

export function createSessionId(id: string): SessionId {
  return id as SessionId;
}

export function createSkillId(id: string): SkillId {
  return id as SkillId;
}
