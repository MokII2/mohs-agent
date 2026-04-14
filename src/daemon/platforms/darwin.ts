/**
 * Darwin (macOS) Daemon Implementation
 *
 * Uses LaunchAgent for service management.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { Daemon, DaemonStatus, DaemonConfig } from '../daemon.js';

const execAsync = promisify(exec);

export class DarwinDaemon extends Daemon {
  private plistPath: string;
  private agentLabel: string;

  constructor(config: DaemonConfig) {
    super(config);
    this.agentLabel = `com.mohs-agent.${config.name}`;
    this.plistPath = join(this.getDaemonDir(), `${this.agentLabel}.plist`);
  }

  /**
   * Start the daemon via launchctl
   */
  async start(): Promise<void> {
    try {
      await execAsync(`launchctl load "${this.plistPath}"`);
      this.status.running = true;
      console.log(`[DarwinDaemon] Started: ${this.agentLabel}`);
    } catch (error) {
      throw new Error(`Failed to start daemon: ${(error as Error).message}`);
    }
  }

  /**
   * Stop the daemon via launchctl
   */
  async stop(): Promise<void> {
    try {
      await execAsync(`launchctl unload "${this.plistPath}"`);
      this.status.running = false;
      console.log(`[DarwinDaemon] Stopped: ${this.agentLabel}`);
    } catch (error) {
      throw new Error(`Failed to stop daemon: ${(error as Error).message}`);
    }
  }

  /**
   * Restart the daemon
   */
  async restart(): Promise<void> {
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.start();
  }

  /**
   * Install the daemon (create LaunchAgent plist)
   */
  async install(): Promise<void> {
    await mkdir(this.getDaemonDir(), { recursive: true });
    await mkdir(this.config.logPath || join(this.getDaemonDir(), 'logs'), { recursive: true });

    const execPath = this.config.execPath || process.execPath;
    const daemonArgs = ['daemon'].concat(this.config.port ? [`--port`, this.config.port.toString()] : []);

    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${this.agentLabel}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${execPath}</string>
        ${daemonArgs.map((arg) => `<string>${arg}</string>`).join('\n        ')}
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${join(this.config.logPath || join(this.getDaemonDir(), 'logs'), 'stdout.log')}</string>
    <key>StandardErrorPath</key>
    <string>${join(this.config.logPath || join(this.getDaemonDir(), 'logs'), 'stderr.log')}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>MOHS_HOME</key>
        <string>${this.getDaemonDir()}</string>
    </dict>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>`;

    await writeFile(this.plistPath, plist, 'utf8');
    this.status.installed = true;
    console.log(`[DarwinDaemon] Installed: ${this.plistPath}`);
  }

  /**
   * Uninstall the daemon (remove LaunchAgent plist)
   */
  async uninstall(): Promise<void> {
    try {
      await this.stop();
    } catch {
      // Ignore if not running
    }

    try {
      await unlink(this.plistPath);
      this.status.installed = false;
      console.log(`[DarwinDaemon] Uninstalled: ${this.plistPath}`);
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
      await readFile(this.plistPath, 'utf8');
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
      await execAsync(`launchctl list | grep "${this.agentLabel}"`);
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
      platform: 'darwin',
      uptime: running ? this.status.uptime : 0,
    };
  }
}
