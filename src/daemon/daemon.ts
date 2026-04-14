/**
 * Daemon Base Class
 *
 * Abstract base class for platform-specific daemon implementations.
 */

import { platform, homedir } from 'os';

export type DaemonPlatform = 'darwin' | 'linux' | 'windows';

export interface DaemonStatus {
  running: boolean;
  uptime: number;
  pid?: number;
  platform: DaemonPlatform;
  installed: boolean;
}

export interface DaemonConfig {
  name: string;
  version: string;
  execPath?: string;
  logPath?: string;
  pidPath?: string;
  port?: number;
}

/**
 * Abstract daemon base class
 */
export abstract class Daemon {
  protected status: DaemonStatus;
  protected config: DaemonConfig;
  protected platform: DaemonPlatform;

  constructor(config: DaemonConfig) {
    this.config = {
      name: 'mohs-agent',
      version: '1.0.0',
      logPath: `${homedir()}/.mohs-agent/logs`,
      pidPath: `${homedir()}/.mohs-agent`,
      ...config,
    };

    this.platform = this.detectPlatform();
    this.status = {
      running: false,
      uptime: 0,
      installed: false,
      platform: this.platform,
    };
  }

  /**
   * Detect current platform
   */
  private detectPlatform(): DaemonPlatform {
    const p = platform();
    if (p === 'darwin') return 'darwin';
    if (p === 'win32') return 'windows';
    return 'linux';
  }

  /**
   * Get daemon status
   */
  async getStatus(): Promise<DaemonStatus> {
    return { ...this.status };
  }

  /**
   * Get config
   */
  getConfig(): DaemonConfig {
    return { ...this.config };
  }

  /**
   * Get daemon directory
   */
  protected getDaemonDir(): string {
    return `${homedir()}/.mohs-agent`;
  }

  /**
   * Get daemon PID file path
   */
  protected getPidPath(): string {
    return `${this.config.pidPath || this.getDaemonDir()}/${this.config.name}.pid`;
  }

  /**
   * Get log file path
   */
  protected getLogPath(): string {
    return `${this.config.logPath || this.getDaemonDir()}/daemon.log`;
  }

  /**
   * Abstract methods to implement per platform
   */
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract restart(): Promise<void>;
  abstract install(): Promise<void>;
  abstract uninstall(): Promise<void>;
  abstract isInstalled(): Promise<boolean>;
  abstract isRunning(): Promise<boolean>;

  /**
   * Get pid from file
   */
  protected async getPidFromFile(): Promise<number | null> {
    try {
      const { readFile } = await import('fs/promises');
      const pidStr = (await readFile(this.getPidPath(), 'utf8')).trim();
      const pid = parseInt(pidStr, 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }

  /**
   * Write pid to file
   */
  protected async writePidToFile(pid: number): Promise<void> {
    const { mkdir, writeFile } = await import('fs/promises');
    const { dirname } = await import('path');
    const dir = dirname(this.getPidPath());

    await mkdir(dir, { recursive: true });
    await writeFile(this.getPidPath(), pid.toString(), 'utf8');
  }

  /**
   * Delete pid file
   */
  protected async deletePidFile(): Promise<void> {
    try {
      const { unlink } = await import('fs/promises');
      await unlink(this.getPidPath());
    } catch {
      // Ignore if doesn't exist
    }
  }
}

/**
 * Daemon service interface
 */
export interface DaemonService {
  label: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  getStatus(): Promise<DaemonStatus>;
  install(): Promise<void>;
  uninstall(): Promise<void>;
}
