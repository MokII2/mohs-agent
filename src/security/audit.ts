/**
 * Security Audit
 *
 * Security audit logging and reporting.
 */

import { stat } from 'fs/promises';
import { access, readFile } from 'fs/promises';
import { constants } from 'fs';

/**
 * Security audit action types
 */
export type SecurityAction =
  | 'config:load'
  | 'config:change'
  | 'session:create'
  | 'session:delete'
  | 'channel:connect'
  | 'channel:disconnect'
  | 'channel:message'
  | 'secret:resolve'
  | 'secret:access'
  | 'plugin:load'
  | 'plugin:unload'
  | 'exec:command'
  | 'file:read'
  | 'file:write'
  | 'network:request';

/**
 * Security audit severity
 */
export type SecurityAuditSeverity = 'info' | 'warn' | 'critical';

/**
 * Security audit finding
 */
export interface SecurityAuditFinding {
  checkId: string;
  severity: SecurityAuditSeverity;
  title: string;
  detail: string;
  remediation?: string;
  timestamp: number;
}

/**
 * Security audit entry
 */
export interface SecurityAuditEntry {
  id: string;
  action: SecurityAction;
  severity: SecurityAuditSeverity;
  actor?: string;
  resource?: string;
  result: 'allow' | 'deny' | 'warn';
  timestamp: number;
  details?: Record<string, unknown>;
}

/**
 * Security audit report
 */
export interface SecurityAuditReport {
  findings: SecurityAuditFinding[];
  summary: {
    total: number;
    bySeverity: Record<SecurityAuditSeverity, number>;
    byAction: Record<string, number>;
  };
  generatedAt: number;
}

/**
 * Security Audit Logger
 */
export class SecurityAudit {
  private entries: SecurityAuditEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Log a security action
   */
  log(entry: Omit<SecurityAuditEntry, 'id' | 'timestamp'>): string {
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const fullEntry: SecurityAuditEntry = {
      ...entry,
      id,
      timestamp: Date.now(),
    };

    this.entries.push(fullEntry);

    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    return id;
  }

  /**
   * Log an allow action
   */
  logAllow(action: SecurityAction, details?: Record<string, unknown>): string {
    return this.log({ action, result: 'allow', severity: 'info', ...(details && { details }) });
  }

  /**
   * Log a deny action
   */
  logDeny(action: SecurityAction, actor?: string, resource?: string): string {
    return this.log({
      action,
      result: 'deny',
      severity: 'critical',
      actor,
      resource,
    });
  }

  /**
   * Log a warning
   */
  logWarn(action: SecurityAction, details?: Record<string, unknown>): string {
    return this.log({ action, result: 'warn', severity: 'warn', ...(details && { details }) });
  }

  /**
   * Get entries with optional filter
   */
  getEntries(filter?: {
    since?: number;
    until?: number;
    action?: SecurityAction;
    result?: 'allow' | 'deny' | 'warn';
    severity?: SecurityAuditSeverity;
  }): SecurityAuditEntry[] {
    let entries = this.entries;

    if (filter?.since) {
      entries = entries.filter((e) => e.timestamp >= filter.since!);
    }

    if (filter?.until) {
      entries = entries.filter((e) => e.timestamp <= filter.until!);
    }

    if (filter?.action) {
      entries = entries.filter((e) => e.action === filter.action);
    }

    if (filter?.result) {
      entries = entries.filter((e) => e.result === filter.result);
    }

    if (filter?.severity) {
      entries = entries.filter((e) => e.severity === filter.severity);
    }

    return entries;
  }

  /**
   * Get recent entries
   */
  getRecent(count = 10): SecurityAuditEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Generate audit report
   */
  generateReport(): SecurityAuditReport {
    const findings: SecurityAuditFinding[] = [];

    // Check for critical entries
    const criticalEntries = this.entries.filter((e) => e.severity === 'critical');

    for (const entry of criticalEntries) {
      findings.push({
        checkId: `critical_${entry.id}`,
        severity: 'critical',
        title: `Critical security event: ${entry.action}`,
        detail: `Action ${entry.action} was ${entry.result}`,
        timestamp: entry.timestamp,
      });
    }

    // Summarize
    const summary = {
      total: this.entries.length,
      bySeverity: {
        info: this.entries.filter((e) => e.severity === 'info').length,
        warn: this.entries.filter((e) => e.severity === 'warn').length,
        critical: criticalEntries.length,
      },
      byAction: this.entries.reduce((acc, e) => {
        acc[e.action] = (acc[e.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return {
      findings,
      summary,
      generatedAt: Date.now(),
    };
  }

  /**
   * Clear audit log
   */
  clear(): void {
    this.entries = [];
  }
}

// Singleton
let globalAudit: SecurityAudit | null = null;

export function getSecurityAudit(): SecurityAudit {
  if (!globalAudit) {
    globalAudit = new SecurityAudit();
  }
  return globalAudit;
}
