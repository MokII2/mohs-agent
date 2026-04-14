/**
 * Daemon Platforms Index
 *
 * Platform-specific daemon implementations.
 */

import { platform } from 'os';
import { Daemon, DaemonConfig, DaemonPlatform } from '../daemon.js';
import { DarwinDaemon } from './darwin.js';
import { LinuxDaemon } from './linux.js';
import { WindowsDaemon } from './windows.js';

/**
 * Create daemon instance for current platform
 */
export function createDaemon(config: DaemonConfig): Daemon {
  const p = platform();

  switch (p) {
    case 'darwin':
      return new DarwinDaemon(config);
    case 'win32':
      return new WindowsDaemon(config);
    default:
      return new LinuxDaemon(config);
  }
}

/**
 * Get platform name
 */
export function getPlatformName(): DaemonPlatform {
  const p = platform();

  switch (p) {
    case 'darwin':
      return 'darwin';
    case 'win32':
      return 'windows';
    default:
      return 'linux';
  }
}

export { DarwinDaemon } from './darwin.js';
export { LinuxDaemon } from './linux.js';
export { WindowsDaemon } from './windows.js';
export type { DaemonPlatform } from '../daemon.js';
