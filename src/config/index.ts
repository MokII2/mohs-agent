/**
 * Config System
 *
 * Configuration loading, validation, and management.
 */

export { ConfigLoader, getConfigLoader } from './loader.js';
export { ConfigWatcher } from './watcher.js';
export {
  Config,
  ConfigUpdate,
  AgentConfig,
  ProviderConfig,
  ChannelConfig,
  MemoryConfig,
  HookConfig,
  SecurityConfig,
  DaemonConfig,
  EvolutionConfig,
  ConfigSchema,
  ConfigUpdateSchema,
} from './schema.js';
export { substituteEnvVars, substituteEnvVarsDeep, containsEnvVars, extractEnvVars } from './env-substitution.js';
export { redactConfig, isRedacted, createRedactedSnapshot, formatRedactedConfig, isSensitiveKey } from './redaction.js';
