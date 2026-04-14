/**
 * Mohs-agent - AI Agent Framework
 *
 * A multi-agent orchestration framework with:
 * - Central Orchestrator (from OpenClaw)
 * - Subagent Routing (from Superpowers)
 * - Self-Evolution (from Hermes)
 * - Five-Layer Memory Architecture (from memory-context)
 *
 * Architecture Overview:
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │                    Central Orchestrator                     │
 *   │              (Multi-Agent Coordination Hub)                │
 *   └─────────────────────────────────────────────────────────────┘
 *       │                    │                    │
 *       ▼                    ▼                    ▼
 *   ┌─────────┐        ┌───────────┐      ┌──────────────┐
 *   │ Subagent │        │ Evolution │      │    Memory    │
 *   │  Router  │        │  Engine   │      │   (5-Layer) │
 *   └─────────┘        └───────────┘      └──────────────┘
 *                                                   │
 *                     ┌─────────────────────────────┼─────────────────────────────┐
 *                     │           │           │           │           │
 *                 Sensory    Working    Semantic    Episodic   Experience
 *
 * Usage:
 * ```typescript
 * import { createAgent, createOrchestrator } from 'mohs-agent';
 *
 * const orchestrator = createOrchestrator();
 * orchestrator.start();
 *
 * const agent = createAgent({ name: 'my-agent' });
 * orchestrator.registerAgent(agent);
 *
 * const result = await orchestrator.submitTask(task, context);
 * ```
 */

// Re-export types first
export type {
  AgentId,
  TaskId,
  SessionId,
  SkillId,
  Task,
  TaskResult,
  TaskStatus,
  TaskPriority,
  TaskInput,
  TaskOutput,
  TaskStep,
  TaskError,
  Message,
  MessageRole,
  ToolCall,
  ToolResult,
  ToolSchema,
  ToolParameter,
  ToolDefinition,
  ToolHandler,
  ExecutionContext,
  IAgent,
  AgentCapability,
  AgentStatus,
  Skill,
  SkillFrontmatter,
  SkillSection,
  SkillMatch,
  RoutingDecision,
  SubagentContext,
  SubagentDefinition,
  MemoryEntry,
  MemoryQuery,
  MemoryConfig,
  MemoryLayerType,
  IMemoryLayer,
  IMemoryClient,
  ISkillRegistry,
  IToolRegistry,
  Reflection,
  ExperienceRecord,
  SkillDraft,
  SkillJudgment,
  PluginManifest,
  SensoryEntry,
  WorkingEntry,
  SemanticEntry,
  EpisodicEntry,
  ExperienceEntry,
  RetentionPolicy,
} from './types/index.js';

// Core exports
export { CentralOrchestrator, orchestrator } from './core/orchestrator/index.js';
export { SubagentRouter } from './core/router/subagent-router.js';

// Agent exports
export { BaseAgent } from './agents/base/agent.js';
export type { BaseAgentConfig, AgentStats } from './agents/base/agent.js';

// Evolution exports
export { EvolutionEngine, DreamProcessor } from './evolution/evolution-engine.js';
export type { EvolutionConfig, EvolutionStats, DreamProcessorConfig, DreamCycleResult } from './evolution/evolution-engine.js';

// Memory exports
export {
  MemoryClient,
  SensoryMemoryLayer,
  WorkingMemoryLayer,
  SemanticMemoryLayer,
  EpisodicMemoryLayer,
  ExperienceMemoryLayer,
  createMemoryClient,
} from './memory/index.js';

// Skill exports
export { SkillRegistry, getDefaultRegistry } from './skills/registry/index.js';
export {
  parseSkillMarkdown,
  generateSkillMarkdown,
  buildSkillIndexEntry,
  getWhenToUse,
  getSkillRules,
} from './skills/markdown-parser/index.js';

// Tool exports
export { ToolRegistry, toolRegistry, registerTool } from './tools/registry.js';

// Plugin exports
export { PluginRegistry, pluginRegistry } from './plugins/registry/index.js';
export type { IPlugin, PluginContext } from './plugins/registry/index.js';

// Provider exports
export {
  ProviderRegistry,
  providerRegistry,
  BaseProvider,
  MiniMaxProvider,
  QwenProvider,
  KimiProvider,
  GLMProvider,
  ClaudeProvider,
  GPTProvider,
  GeminiProvider,
  OllamaProvider,
  DeepSeekProvider,
} from './providers/index.js';
export type { LLMProvider, ProviderConfig, ChatCompletionRequest } from './providers/base/types.js';

// Channel exports
export {
  ChannelRegistry,
  channelRegistry,
  BaseChannel,
  TelegramChannel,
  DiscordChannel,
  WhatsAppChannel,
  SlackChannel,
  WeChatChannel,
  WebChatChannel,
  FeishuChannel,
  MSTeamsChannel,
  BlueBubblesChannel,
  IMessageChannel,
} from './channels/index.js';
export type { IChannel, ChannelConfig, ChannelStatus, InboundMessage, OutboundMessage } from './channels/base/types.js';

// Factory function exports
export { createSimpleAgent, createOrchestrator, createAgentMemory } from './factories.js';

// Config exports
export { getConfigLoader, ConfigLoader } from './config/loader.js';
export { ConfigSchema, AgentConfigSchema, ProviderConfigSchema, ChannelConfigSchema, MemoryConfigSchema } from './config/schema.js';
export { ConfigWatcher } from './config/watcher.js';
export { substituteEnvVars } from './config/env-substitution.js';
export { redactConfig } from './config/redaction.js';

// Secrets exports
export { getSecretResolver, SecretResolver } from './secrets/resolver.js';
export type { SecretRef, SecretValue } from './secrets/types.js';
export { SecretsAudit, getSecretsAudit } from './secrets/audit.js';

// Hooks exports
export { HookRegistry, getHookRegistry } from './hooks/registry.js';
export { HookDispatcher } from './hooks/dispatcher.js';
export type { HookEvent } from './hooks/types.js';

// Session exports
export { MemorySessionStore, getSessionStore } from './sessions/memory-store.js';
export { parseSessionKey, createSessionKey, isValidSessionKey, displaySessionKey } from './sessions/key-resolver.js';
export { SessionLifecycle, getSessionLifecycle } from './sessions/lifecycle.js';
export { SessionTranscript } from './sessions/transcript.js';
export type {
  Session,
  SessionMetadata,
  TranscriptEntry,
  SessionStatus,
  SessionFilter,
  CreateSessionOptions,
  UpdateSessionOptions,
  SessionStore,
  SessionLifecycleEventType,
  SessionLifecycleEvent,
  SessionLifecycleListener,
} from './sessions/index.js';

// Security exports
export { SecurityAudit, getSecurityAudit } from './security/audit.js';
export { FilesystemPermissions } from './security/permissions.js';
export { DMPolicyResolver } from './security/dm-policy.js';

// Protocol exports
export { Gateway } from './protocol/gateway.js';
export type { Frame, RequestFrame, ResponseFrame, EventFrame } from './protocol/frames.js';
export { encode, decode, encodeNDJSON, decodeNDJSON, createMessageReader } from './protocol/codec.js';
export { negotiate, PROTOCOL_VERSION, getProtocolVersionInfo } from './protocol/negotiation.js';

// ACP exports
export { ACPServer } from './acp/server.js';
export { ACPClient } from './acp/client.js';
export { ACPSession } from './acp/session.js';
export { mapACPToGateway, mapGatewayToACP, createACPEvent } from './acp/event-mapper.js';

// Daemon exports
export { DaemonService, createDaemonService } from './daemon/service.js';
export { Daemon, DaemonStatus, DaemonConfig } from './daemon/daemon.js';
export { createDaemon, getPlatformName } from './daemon/platforms/index.js';
export { DarwinDaemon } from './daemon/platforms/darwin.js';
export { LinuxDaemon } from './daemon/platforms/linux.js';
export { WindowsDaemon } from './daemon/platforms/windows.js';

// CLI exports
export { createCLI, entry } from './cli/entry.js';
