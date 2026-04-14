/**
 * Config Schema Definitions
 *
 * JSON Schema and Zod schemas for configuration validation.
 */

import { z } from 'zod';

/**
 * Agent configuration schema
 */
export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  systemPrompt: z.string().optional(),
  tools: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Provider configuration schema
 */
export const ProviderConfigSchema = z.object({
  id: z.string(),
  type: z.enum(['openai', 'anthropic', 'google', 'local', 'minimax', 'qwen', 'kimi', 'glm', 'deepseek']),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  organization: z.string().optional(),
  models: z.array(z.string()).optional(),
  defaultModel: z.string().optional(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

/**
 * Channel configuration schema
 */
export const ChannelConfigSchema = z.object({
  enabled: z.boolean().default(true),
  type: z.string(),
  botToken: z.string().optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  webhookSecret: z.string().optional(),
  pollingInterval: z.number().positive().optional(),
});

export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

/**
 * Memory configuration schema
 */
export const MemoryLayerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  ttlMs: z.number().positive().optional(),
  maxSize: z.number().positive().optional(),
});

export const MemoryConfigSchema = z.object({
  enabledLayers: z.array(z.enum(['sensory', 'working', 'semantic', 'episodic', 'experience'])).default(['semantic']),
  chromaPath: z.string().optional(),
  chromaPort: z.number().positive().optional(),
  defaultTtlMs: z.number().positive().optional(),
  sensory: MemoryLayerConfigSchema.optional(),
  working: MemoryLayerConfigSchema.optional(),
  semantic: MemoryLayerConfigSchema.optional(),
  episodic: MemoryLayerConfigSchema.optional(),
  experience: MemoryLayerConfigSchema.optional(),
});

export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;

/**
 * Hook configuration schema
 */
export const HookSourceConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  events: z.array(z.string()),
  priority: z.number().int().default(0),
});

export const HookConfigSchema = z.object({
  enabled: z.boolean().default(true),
  sources: z.array(HookSourceConfigSchema).default([]),
});

export type HookConfig = z.infer<typeof HookConfigSchema>;

/**
 * Security configuration schema
 */
export const SecurityConfigSchema = z.object({
  auditEnabled: z.boolean().default(true),
  auditPath: z.string().optional(),
  allowedChannels: z.array(z.string()).optional(),
  blockedChannels: z.array(z.string()).optional(),
  dmPolicy: z.enum(['allow', 'block', 'pairing']).default('pairing'),
  filesystemPermissions: z.object({
    strictMode: z.boolean().default(false),
    allowedPaths: z.array(z.string()).optional(),
    deniedPaths: z.array(z.string()).optional(),
  }).optional(),
});

export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;

/**
 * Daemon configuration schema
 */
export const DaemonConfigSchema = z.object({
  enabled: z.boolean().default(false),
  port: z.number().positive().default(18789),
  host: z.string().default('localhost'),
  tls: z.object({
    enabled: z.boolean().default(false),
    certPath: z.string().optional(),
    keyPath: z.string().optional(),
  }).optional(),
  authentication: z.object({
    token: z.string().optional(),
    requireAuth: z.boolean().default(true),
  }).optional(),
});

export type DaemonConfig = z.infer<typeof DaemonConfigSchema>;

/**
 * Evolution/Dream configuration schema
 */
export const EvolutionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  dreamCycleIntervalMs: z.number().positive().optional(),
  minComplexityScore: z.number().min(0).max(1).default(0.6),
  maxExperiencesPerCycle: z.number().positive().default(50),
  autoApproveSkills: z.boolean().default(false),
});

export type EvolutionConfig = z.infer<typeof EvolutionConfigSchema>;

/**
 * Main configuration schema
 */
export const ConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  agent: AgentConfigSchema,
  providers: z.record(z.string(), ProviderConfigSchema).default({}),
  channels: z.record(z.string(), ChannelConfigSchema).default({}),
  memory: MemoryConfigSchema.optional(),
  hooks: HookConfigSchema.optional(),
  security: SecurityConfigSchema.optional(),
  daemon: DaemonConfigSchema.optional(),
  evolution: EvolutionConfigSchema.optional(),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    path: z.string().optional(),
    maxFileSize: z.number().positive().optional(),
    maxFiles: z.number().positive().optional(),
  }).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Partial config for updates
 */
export const ConfigUpdateSchema = ConfigSchema.partial();
export type ConfigUpdate = z.infer<typeof ConfigUpdateSchema>;
