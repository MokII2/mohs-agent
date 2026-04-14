/**
 * Filesystem Permissions
 *
 * Filesystem permission checking for security.
 */

import { stat } from 'fs/promises';
import { constants } from 'fs';
import { homedir } from 'os';

const HOME_DIR = homedir();

/**
 * Permission operation types
 */
export type PermissionOperation = 'read' | 'write' | 'execute' | 'delete';

/**
 * Permission check result
 */
export interface PermissionCheck {
  allowed: boolean;
  path: string;
  operation: PermissionOperation;
  reason?: string;
}

/**
 * Path permission policy
 */
export interface PathPermissionPolicy {
  allowed: boolean;
  reason?: string;
}

/**
 * Filesystem permission checker
 */
export class FilesystemPermissions {
  private allowedPaths: string[] = [];
  private deniedPaths: string[] = [];
  private strictMode: boolean = false;

  constructor(options?: {
    allowedPaths?: string[];
    deniedPaths?: string[];
    strictMode?: boolean;
  }) {
    this.allowedPaths = options?.allowedPaths || [];
    this.deniedPaths = options?.deniedPaths || [];
    this.strictMode = options?.strictMode || false;
  }

  /**
   * Check if an operation is allowed on a path
   */
  async check(path: string, operation: PermissionOperation): Promise<PermissionCheck> {
    // Resolve path
    const resolved = this.resolvePath(path);

    // Check denied paths first
    for (const denied of this.deniedPaths) {
      if (this.isSubPath(denied, resolved)) {
        return {
          allowed: false,
          path: resolved,
          operation,
          reason: `Path matches denied pattern: ${denied}`,
        };
      }
    }

    // Check allowed paths
    if (this.allowedPaths.length > 0) {
      let allowed = false;
      for (const allowedPath of this.allowedPaths) {
        if (this.isSubPath(allowedPath, resolved)) {
          allowed = true;
          break;
        }
      }

      if (!allowed) {
        return {
          allowed: false,
          path: resolved,
          operation,
          reason: 'Path not in allowed list',
        };
      }
    }

    // In strict mode, check actual filesystem permissions
    if (this.strictMode) {
      return this.checkFilesystemPermission(resolved, operation);
    }

    return {
      allowed: true,
      path: resolved,
      operation,
    };
  }

  /**
   * Check actual filesystem permissions
   */
  private async checkFilesystemPermission(
    path: string,
    operation: PermissionOperation
  ): Promise<PermissionCheck> {
    try {
      const stats = await stat(path);
      const mode = stats.mode;

      let hasPermission = false;
      switch (operation) {
        case 'read':
          hasPermission = Boolean(mode & (constants.S_IRUSR | constants.S_IRGRP | constants.S_IROTH));
          break;
        case 'write':
          hasPermission = Boolean(mode & (constants.S_IWUSR | constants.S_IWGRP | constants.S_IWOTH));
          break;
        case 'execute':
          hasPermission = Boolean(mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH));
          break;
        case 'delete':
          // For delete, we check write permission on parent
          hasPermission = Boolean(mode & constants.S_IWUSR);
          break;
      }

      return {
        allowed: hasPermission,
        path,
        operation,
        reason: hasPermission ? undefined : `Filesystem permission denied for ${operation}`,
      };
    } catch (error) {
      return {
        allowed: false,
        path,
        operation,
        reason: `Cannot access path: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check if path is a subpath of another
   */
  private isSubPath(parent: string, child: string): boolean {
    const normalizedParent = parent.replace(/\\/g, '/').replace(/\/+$/, '');
    const normalizedChild = child.replace(/\\/g, '/').replace(/\/+$/, '');

    if (normalizedChild === normalizedParent) return true;
    return normalizedChild.startsWith(normalizedParent + '/');
  }

  /**
   * Resolve path (handle ~, relative paths, etc.)
   */
  private resolvePath(path: string): string {
    if (path.startsWith('~/')) {
      return path.replace('~/', HOME_DIR + '/');
    }
    if (path === '~') {
      return HOME_DIR;
    }
    return path;
  }

  /**
   * Get permission policy for a path
   */
  async resolvePolicy(path: string): Promise<PathPermissionPolicy> {
    const check = await this.check(path, 'read');
    return {
      allowed: check.allowed,
      reason: check.reason,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: {
    allowedPaths?: string[];
    deniedPaths?: string[];
    strictMode?: boolean;
  }): void {
    if (config.allowedPaths) this.allowedPaths = config.allowedPaths;
    if (config.deniedPaths) this.deniedPaths = config.deniedPaths;
    if (config.strictMode !== undefined) this.strictMode = config.strictMode;
  }
}
