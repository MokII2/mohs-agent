/**
 * Factory functions for quick agent setup
 */

import { createAgentId, createTaskId, createSessionId, createSkillId } from './types/index.js';
import type {
  AgentId,
  TaskId,
  SessionId,
  SkillId,
  IAgent,
  OrchestratorConfig,
  MemoryConfig,
} from './types/index.js';
import { CentralOrchestrator } from './core/orchestrator/index.js';
import { MemoryClient } from './memory/index.js';
import { DefaultAgent } from './core/orchestrator/default-agent.js';

/**
 * Create a simple agent with minimal configuration
 */
export function createSimpleAgent(config: {
  name: string;
  systemPrompt?: string;
  capabilities?: string[];
}): IAgent {
  return new DefaultAgent(config.name);
}

/**
 * Create the default orchestrator
 */
export function createOrchestrator(config?: OrchestratorConfig) {
  return new CentralOrchestrator(config);
}

/**
 * Create a memory client for an agent
 */
export function createAgentMemory(
  agentId: string,
  config?: MemoryConfig
) {
  return new MemoryClient(createAgentId(agentId), config);
}

/**
 * Create a new agent ID
 */
export function newAgentId(id?: string): AgentId {
  return createAgentId(id ?? crypto.randomUUID());
}

/**
 * Create a new task ID
 */
export function newTaskId(id?: string): TaskId {
  return createTaskId(id ?? crypto.randomUUID());
}

/**
 * Create a new session ID
 */
export function newSessionId(id?: string): SessionId {
  return createSessionId(id ?? crypto.randomUUID());
}

/**
 * Create a new skill ID
 */
export function newSkillId(id?: string): SkillId {
  return createSkillId(id ?? crypto.randomUUID());
}
