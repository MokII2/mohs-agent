/**
 * Windows Daemon Implementation
 *
 * Uses Task Scheduler for service management.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { Daemon, DaemonStatus, DaemonConfig } from '../daemon.js';

const execAsync = promisify(exec);

export class WindowsDaemon extends Daemon {
  private taskName: string;

  constructor(config: DaemonConfig) {
    super(config);
    this.taskName = `MohsAgent_${config.name}`;
  }

  /**
   * Start the scheduled task
   */
  async start(): Promise<void> {
    try {
      await execAsync(`schtasks /run /tn "${this.taskName}"`);
      this.status.running = true;
      console.log(`[WindowsDaemon] Started: ${this.taskName}`);
    } catch (error) {
      throw new Error(`Failed to start daemon: ${(error as Error).message}`);
    }
  }

  /**
   * Stop the scheduled task
   */
  async stop(): Promise<void> {
    try {
      // Windows scheduled tasks don't have a direct stop, but we can end the process
      await execAsync(`schtasks /end /tn "${this.taskName}"`);
      this.status.running = false;
      console.log(`[WindowsDaemon] Stopped: ${this.taskName}`);
    } catch (error) {
      throw new Error(`Failed to stop daemon: ${(error as Error).message}`);
    }
  }

  /**
   * Restart the scheduled task
   */
  async restart(): Promise<void> {
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.start();
  }

  /**
   * Install the daemon (create scheduled task)
   */
  async install(): Promise<void> {
    const appDataDir = process.env.APPDATA || join(process.env.USERPROFILE || '/tmp', 'AppData', 'Roaming');
    const daemonDir = join(appDataDir, 'MohsAgent');

    await mkdir(daemonDir, { recursive: true });
    await mkdir(this.config.logPath || join(daemonDir, 'logs'), { recursive: true });

    const execPath = this.config.execPath || process.execPath;
    const daemonArgs = ['daemon'].concat(this.config.port ? [`--port`, this.config.port.toString()] : []);

    // Create task using schtasks
    const command = `schtasks /create /tn "${this.taskName}" /tr "\\"${execPath}\\" ${daemonArgs.join(' ')}" /sc onlogon /rl limited`;

    try {
      await execAsync(command);
      this.status.installed = true;
      console.log(`[WindowsDaemon] Installed: ${this.taskName}`);
    } catch (error) {
      throw new Error(`Failed to install daemon: ${(error as Error).message}`);
    }
  }

  /**
   * Uninstall the daemon (remove scheduled task)
   */
  async uninstall(): Promise<void> {
    try {
      await this.stop();
    } catch {
      // Ignore if not running
    }

    try {
      await execAsync(`schtasks /delete /tn "${this.taskName}" /f`);
      this.status.installed = false;
      console.log(`[WindowsDaemon] Uninstalled: ${this.taskName}`);
    } catch (error) {
      throw new Error(`Failed to uninstall daemon: ${(error as Error).message}`);
    }
  }

  /**
   * Check if installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`schtasks /query /tn "${this.taskName}"`);
      return stdout.includes(this.taskName);
    } catch {
      return false;
    }
  }

  /**
   * Check if running
   */
  async isRunning(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`schtasks /query /tn "${this.taskName}" /fo csv /nh`);
      return stdout.includes('Running');
    } catch {
      return false;
    }
  }

  /**
   * Get daemon status
   */
  async getStatus(): Promise<DaemonStatus> {
    const running = await this.isRunning();
    const installed = await this.isInstalled();

    return {
      running,
      installed,
      platform: 'windows',
      uptime: running ? this.status.uptime : 0,
    };
  }
}
