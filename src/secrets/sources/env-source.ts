/**
 * Environment Variable Secret Source
 *
 * Resolves secrets from environment variables.
 */

import type { EnvSecretRef, SecretValue } from '../types.js';

/**
 * Resolve a secret from environment variable
 */
export function resolveEnvSecret(ref: EnvSecretRef, env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): string | null {
  const value = env[ref.key];
  return value ?? null;
}

/**
 * Create SecretValue from environment variable
 */
export function resolveEnvSecretValue(ref: EnvSecretRef, env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): SecretValue | null {
  const value = resolveEnvSecret(ref, env);

  if (value === null) {
    return null;
  }

  return {
    value,
    source: 'env',
    key: ref.key,
    resolvedAt: Date.now(),
  };
}

/**
 * Check if an environment variable exists
 */
export function hasEnvSecret(ref: EnvSecretRef, env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): boolean {
  return ref.key in env && env[ref.key] !== undefined;
}

/**
 * List all secret-relevant environment variables
 * (keys that look like API keys, tokens, etc.)
 */
export function listRelevantEnvVars(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): string[] {
  const patterns = [
    /API[_-]?KEY/i,
    /SECRET/i,
    /TOKEN/i,
    /PASSWORD/i,
    /AUTH/i,
    /CREDENTIAL/i,
    /PRIVATE[_-]?KEY/i,
    /ACCESS[_-]?TOKEN/i,
    /REFRESH[_-]?TOKEN/i,
  ];

  return Object.keys(env).filter((key) =>
    patterns.some((pattern) => pattern.test(key))
  );
}
