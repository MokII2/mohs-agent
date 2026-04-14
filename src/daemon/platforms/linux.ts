/**
 * Linux Daemon Implementation
 *
 * Uses systemd user service for service management.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { Daemon, DaemonStatus, DaemonConfig } from '../daemon.js';

const execAsync = promisify(exec);

export class LinuxDaemon extends Daemon {
  private unitName: string;
  private unitPath: string;

  constructor(config: DaemonConfig) {
    super(config);
    this.unitName = `mohs-agent-${config.name}.service`;
    this.unitPath = join(process.env.HOME || '/tmp', '.config', 'systemd', 'user', this.unitName);
  }

  /**
   * Start the systemd service
   */
  async start(): Promise<void> {
    try {
      await execAsync(`systemctl --user start ${this.unitName}`);
      this.status.running = true;
      console.log(`[LinuxDaemon] Started: ${this.unitName}`);
    } catch (error) {
      throw new Error(`Failed to start daemon: ${(error as Error).message}`);
    }
  }

  /**
   * Stop the systemd service
   */
  async stop(): Promise<void> {
    try {
      await execAsync(`systemctl --user stop ${this.unitName}`);
      this.status.running = false;
      console.log(`[LinuxDaemon] Stopped: ${this.unitName}`);
    } catch (error) {
      throw new Error(`Failed to stop daemon: ${(error as Error).message}`);
    }
  }

  /**
   * Restart the systemd service
   */
  async restart(): Promise<void> {
    try {
      await execAsync(`systemctl --user restart ${this.unitName}`);
      console.log(`[LinuxDaemon] Restarted: ${this.unitName}`);
    } catch (error) {
      throw new Error(`Failed to restart daemon: ${(error as Error).message}`);
    }
  }

  /**
   * Install the daemon (create systemd unit file)
   */
  async install(): Promise<void> {
    const xdgDir = process.env.XDG_CONFIG_HOME || join(process.env.HOME || '/tmp', '.config');
    const systemdDir = join(xdgDir, 'systemd', 'user');

    await mkdir(systemdDir, { recursive: true });
    await mkdir(this.config.logPath || join(this.getDaemonDir(), 'logs'), { recursive: true });

    const execPath = this.config.execPath || process.execPath;
    const daemonArgs = ['daemon'].concat(this.config.port ? [`--port`, this.config.port.toString()] : []);

    const unit = `[Unit]
Description=Mohs Agent Service
After=network.target

[Service]
Type=simple
ExecStart=${execPath} ${daemonArgs.join(' ')}
Restart=always
RestartSec=5
Environment=MOHS_HOME=${this.getDaemonDir()}

[Install]
WantedBy=default.target`;

    await writeFile(this.unitPath, unit, 'utf8');
    this.status.installed = true;
    console.log(`[LinuxDaemon] Installed: ${this.unitPath}`);

    // Enable lingering for background running
    try {
      await execAsync(`loginctl enable-linger`);
    } catch {
      console.warn('[LinuxDaemon] Could not enable linger (may require root)');
    }
  }

  /**
   * Uninstall the daemon (remove systemd unit file)
   */
  async uninstall(): Promise<void> {
    try {
      await this.stop();
    } catch {
      // Ignore if not running
    }

    try {
      await unlink(this.unitPath);
      this.status.installed = false;
      console.log(`[LinuxDaemon] Uninstalled: ${this.unitPath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      await readFile(this.unitPath, 'utf8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if running
   */
  async isRunning(): Promise<boolean> {
    try {
      await execAsync(`systemctl --user is-active ${this.unitName}`);
      return true;
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
      platform: 'linux',
      uptime: running ? this.status.uptime : 0,
    };
  }
}
