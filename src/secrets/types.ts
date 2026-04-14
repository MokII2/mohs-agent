/**
 * Secrets Types
 *
 * Type definitions for secret references and resolution.
 */

/**
 * Secret source types
 */
export type SecretSource = 'env' | 'file' | 'exec';

/**
 * Environment variable secret reference
 */
export interface EnvSecretRef {
  source: 'env';
  key: string;
}

/**
 * File-based secret reference
 */
export interface FileSecretRef {
  source: 'file';
  path: string;
  key?: string;  // For JSON files, key to extract
  encoding?: 'utf8' | 'base64';
}

/**
 * Executable-based secret reference
 */
export interface ExecSecretRef {
  source: 'exec';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  parse?: 'stdout' | 'json';
  timeoutMs?: number;
}

/**
 * Union type for all secret references
 */
export type SecretRef = EnvSecretRef | FileSecretRef | ExecSecretRef;

/**
 * Secret resolution result
 */
export interface SecretValue {
  value: string;
  source: SecretSource;
  key: string;
  resolvedAt: number;
}

/**
 * Secret audit entry
 */
export interface SecretAuditEntry {
  timestamp: number;
  ref: SecretRef;
  success: boolean;
  key: string;
  error?: string;
  durationMs: number;
}

/**
 * Secret resolution options
 */
export interface ResolveOptions {
  cache?: boolean;
  cacheTtlMs?: number;
}

/**
 * Secrets config for a provider
 */
export interface ProviderSecretsConfig {
  provider: string;
  secrets: SecretRef[];
}

/**
 * Validation result for secret ref
 */
export interface SecretValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Parse a secret ref from string notation
 * Examples:
 * - env:API_KEY
 * - file:/secrets/api.key
 * - exec:get-secret --key api
 */
export function parseSecretRef(input: string): SecretRef | null {
  // env:KEY format
  if (input.startsWith('env:')) {
    return { source: 'env', key: input.slice(4) };
  }

  // file:/path/to/secret format
  if (input.startsWith('file:')) {
    const path = input.slice(5);
    // Check for JSON key notation: file:/path/to/file.json#key
    const hashIndex = path.indexOf('#');
    if (hashIndex !== -1) {
      return {
        source: 'file',
        path: path.slice(0, hashIndex),
        key: path.slice(hashIndex + 1),
      };
    }
    return { source: 'file', path };
  }

  // exec:command args format
  if (input.startsWith('exec:')) {
    const remainder = input.slice(5);
    const parts = remainder.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    return { source: 'exec', command, args };
  }

  return null;
}

/**
 * Format a secret ref to string notation
 */
export function formatSecretRef(ref: SecretRef): string {
  switch (ref.source) {
    case 'env':
      return `env:${ref.key}`;
    case 'file':
      return ref.key ? `file:${ref.path}#${ref.key}` : `file:${ref.path}`;
    case 'exec':
      return ref.args?.length ? `exec:${ref.command} ${ref.args.join(' ')}` : `exec:${ref.command}`;
  }
}
