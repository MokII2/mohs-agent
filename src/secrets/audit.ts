/**
 * Secrets Audit
 *
 * Auditing for secret resolution and security.
 */

import type { SecretAuditEntry, SecretRef } from './types.js';

/**
 * Secrets audit log
 */
export class SecretsAudit {
  private entries: SecretAuditEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Log a secret resolution attempt
   */
  log(entry: Omit<SecretAuditEntry, 'timestamp'>): void {
    const fullEntry: SecretAuditEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    this.entries.push(fullEntry);

    // Trim if needed
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  /**
   * Log a successful resolution
   */
  logSuccess(ref: SecretRef, key: string, durationMs: number): void {
    this.log({
      ref,
      key,
      success: true,
      durationMs,
    });
  }

  /**
   * Log a failed resolution
   */
  logFailure(ref: SecretRef, key: string, error: string, durationMs: number): void {
    this.log({
      ref,
      key,
      success: false,
      error,
      durationMs,
    });
  }

  /**
   * Get all audit entries
   */
  getEntries(filter?: {
    since?: number;
    until?: number;
    success?: boolean;
    key?: string;
  }): SecretAuditEntry[] {
    let entries = this.entries;

    if (filter?.since) {
      entries = entries.filter((e) => e.timestamp >= filter.since!);
    }

    if (filter?.until) {
      entries = entries.filter((e) => e.timestamp <= filter.until!);
    }

    if (filter?.success !== undefined) {
      entries = entries.filter((e) => e.success === filter.success);
    }

    if (filter?.key) {
      entries = entries.filter((e) => e.key === filter.key);
    }

    return entries;
  }

  /**
   * Get recent entries
   */
  getRecent(count = 10): SecretAuditEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Get failure count
   */
  getFailureCount(since?: number): number {
    let entries = this.entries;

    if (since) {
      entries = entries.filter((e) => e.timestamp >= since);
    }

    return entries.filter((e) => !e.success).length;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
  }
}

// Global audit instance
let globalAudit: SecretsAudit | null = null;

export function getSecretsAudit(): SecretsAudit {
  if (!globalAudit) {
    globalAudit = new SecretsAudit();
  }
  return globalAudit;
}
