/**
 * Secrets System
 *
 * Secret resolution from various sources (env, file, exec).
 */

export {
  SecretResolver,
  getSecretResolver,
} from './resolver.js';

export {
  SecretsAudit,
  getSecretsAudit,
} from './audit.js';

export {
  SecretRef,
  SecretValue,
  SecretAuditEntry,
  EnvSecretRef,
  FileSecretRef,
  ExecSecretRef,
  ProviderSecretsConfig,
  SecretValidationResult,
  parseSecretRef,
  formatSecretRef,
} from './types.js';

export {
  resolveEnvSecret,
  resolveEnvSecretValue,
  hasEnvSecret,
  listRelevantEnvVars,
} from './sources/env-source.js';

export {
  resolveFileSecret,
  resolveFileSecretValue,
  isFileSecretAccessible,
} from './sources/file-source.js';

export {
  resolveExecSecret,
  resolveExecSecretValue,
  isExecSecretAvailable,
} from './sources/index.js';
