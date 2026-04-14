/**
 * Secret Resolver
 *
 * Resolves secret references from various sources.
 */

import type { SecretRef, SecretValue, ResolveOptions } from './types.js';
import { parseSecretRef, formatSecretRef } from './types.js';
import { resolveEnvSecretValue, hasEnvSecret } from './sources/env-source.js';
import { resolveFileSecretValue } from './sources/file-source.js';
import { resolveExecSecretValue } from './sources/exec-source.js';
import { SecretsAudit, getSecretsAudit } from './audit.js';

/**
 * Cache entry for resolved secrets
 */
interface CacheEntry {
  value: string;
  expiresAt: number;
}

/**
 * Secret Resolver
 */
export class SecretResolver {
  private cache: Map<string, CacheEntry> = new Map();
  private audit: SecretsAudit;

  constructor(audit?: SecretsAudit) {
    this.audit = audit || getSecretsAudit();
  }

  /**
   * Resolve a secret reference to its value
   */
  async resolve(ref: SecretRef, options?: ResolveOptions): Promise<SecretValue | null> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(ref);

    // Check cache first
    if (options?.cache !== false) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          value: cached.value,
          source: ref.source,
          key: this.getKey(ref),
          resolvedAt: cached.expiresAt - (options.cacheTtlMs || 60000), // Approximate
        };
      }
    }

    let result: SecretValue | null = null;

    try {
      switch (ref.source) {
        case 'env':
          result = await resolveEnvSecretValue(ref);
          break;
        case 'file':
          result = await resolveFileSecretValue(ref);
          break;
        case 'exec':
          result = await resolveExecSecretValue(ref);
          break;
      }

      const durationMs = Date.now() - startTime;

      if (result) {
        this.audit.logSuccess(ref, this.getKey(ref), durationMs);

        // Cache if enabled
        if (options?.cache !== false) {
          this.cache.set(cacheKey, {
            value: result.value,
            expiresAt: Date.now() + (options?.cacheTtlMs || 60000),
          });
        }
      } else {
        this.audit.logFailure(ref, this.getKey(ref), 'Resolution returned null', durationMs);
      }

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.audit.logFailure(ref, this.getKey(ref), errorMsg, durationMs);
      return null;
    }
  }

  /**
   * Resolve many secrets
   */
  async resolveMany(refs: SecretRef[], options?: ResolveOptions): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    await Promise.all(
      refs.map(async (ref) => {
        const result = await this.resolve(ref, options);
        if (result) {
          results.set(this.getKey(ref), result.value);
        }
      })
    );

    return results;
  }

  /**
   * Resolve a secret by string notation
   */
  async resolveString(input: string, options?: ResolveOptions): Promise<string | null> {
    const ref = parseSecretRef(input);
    if (!ref) {
      console.warn(`[SecretResolver] Invalid secret ref: ${input}`);
      return null;
    }

    const result = await this.resolve(ref, options);
    return result?.value ?? null;
  }

  /**
   * Check if a secret ref is available
   */
  async isAvailable(ref: SecretRef): Promise<boolean> {
    switch (ref.source) {
      case 'env':
        return hasEnvSecret(ref);
      case 'file':
        try {
          const { access } = await import('fs/promises');
          await access(ref.path);
          return true;
        } catch {
          return false;
        }
      case 'exec':
        const { isExecSecretAvailable } = await import('./sources/exec-source.js');
        return isExecSecretAvailable(ref);
    }
  }

  /**
   * Clear the resolution cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate a specific cached secret
   */
  invalidate(ref: SecretRef): void {
    const cacheKey = this.getCacheKey(ref);
    this.cache.delete(cacheKey);
  }

  /**
   * Get cache key for a ref
   */
  private getCacheKey(ref: SecretRef): string {
    return formatSecretRef(ref);
  }

  /**
   * Get display key for a ref
   */
  private getKey(ref: SecretRef): string {
    switch (ref.source) {
      case 'env':
        return ref.key;
      case 'file':
        return ref.key || ref.path;
      case 'exec':
        return ref.command;
    }
  }
}

// Singleton instance
let globalResolver: SecretResolver | null = null;

export function getSecretResolver(): SecretResolver {
  if (!globalResolver) {
    globalResolver = new SecretResolver();
  }
  return globalResolver;
}
