/**
 * Daemon System
 *
 * Platform-specific daemon management.
 */

export { DaemonService, createDaemonService } from './service.js';
export { Daemon, DaemonStatus, DaemonConfig, type DaemonPlatform } from './daemon.js';
export { createDaemon, getPlatformName } from './platforms/index.js';
export { DarwinDaemon } from './platforms/darwin.js';
export { LinuxDaemon } from './platforms/linux.js';
export { WindowsDaemon } from './platforms/windows.js';
