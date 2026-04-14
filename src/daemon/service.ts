/**
 * Daemon Service
 *
 * High-level daemon service interface.
 */

import { createDaemon, getPlatformName } from './platforms/index.js';
import type { Daemon, DaemonConfig, DaemonStatus } from './daemon.js';
import type { DaemonPlatform } from './platforms/index.js';

export interface DaemonServiceOptions {
  name?: string;
  version?: string;
  port?: number;
  execPath?: string;
}

/**
 * Daemon service wrapper
 */
export class DaemonService {
  private daemon: Daemon;
  private options: Required<DaemonServiceOptions>;

  constructor(options: DaemonServiceOptions = {}) {
    this.options = {
      name: options.name || 'agent',
      version: options.version || '1.0.0',
      port: options.port || 18789,
      execPath: options.execPath || process.execPath,
    };

    const config: DaemonConfig = {
      name: this.options.name,
      version: this.options.version,
      execPath: this.options.execPath,
      port: this.options.port,
    };

    this.daemon = createDaemon(config);
  }

  /**
   * Start the daemon service
   */
  async start(): Promise<void> {
    const status = await this.daemon.getStatus();

    if (!status.installed) {
      await this.daemon.install();
    }

    await this.daemon.start();
  }

  /**
   * Stop the daemon service
   */
  async stop(): Promise<void> {
    await this.daemon.stop();
  }

  /**
   * Restart the daemon service
   */
  async restart(): Promise<void> {
    await this.daemon.restart();
  }

  /**
   * Install the daemon service
   */
  async install(): Promise<void> {
    await this.daemon.install();
  }

  /**
   * Uninstall the daemon service
   */
  async uninstall(): Promise<void> {
    await this.daemon.uninstall();
  }

  /**
   * Get daemon status
   */
  async getStatus(): Promise<DaemonStatus> {
    return this.daemon.getStatus();
  }

  /**
   * Check if daemon is running
   */
  async isRunning(): Promise<boolean> {
    return this.daemon.isRunning();
  }

  /**
   * Check if daemon is installed
   */
  async isInstalled(): Promise<boolean> {
    return this.daemon.isInstalled();
  }

  /**
   * Get platform
   */
  getPlatform(): DaemonPlatform {
    return getPlatformName();
  }

  /**
   * Get daemon config
   */
  getConfig(): DaemonConfig {
    return this.daemon.getConfig();
  }
}

/**
 * Create default daemon service
 */
export function createDaemonService(options?: DaemonServiceOptions): DaemonService {
  return new DaemonService(options);
}
