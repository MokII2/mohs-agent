/**
 * Daemon Command
 *
 * Manage the mohs-agent daemon service.
 */

import { style, printSection, printKeyValue, printSuccess, printError, printWarning, printInfo } from '../utils/console.js';
import { createDaemonService } from '../../daemon/index.js';

export async function daemonCommand(args: { action?: string }): Promise<void> {
  const service = createDaemonService();
  const action = args.action || 'status';

  console.log('');
  console.log(style.bold(style.cyan(`═══ Daemon: ${action} ═══`)));
  console.log('');

  try {
    switch (action) {
      case 'status': {
        const status = await service.getStatus();
        printKeyValue('Platform', status.platform);
        printKeyValue('Installed', status.installed ? style.green('Yes') : style.red('No'));
        printKeyValue('Running', status.running ? style.green('Yes') : style.red('No'));
        if (status.uptime) {
          printKeyValue('Uptime', `${Math.floor(status.uptime / 1000)}s`);
        }
        break;
      }

      case 'start': {
        const wasRunning = await service.isRunning();
        await service.start();
        if (wasRunning) {
          printInfo('Daemon already running');
        } else {
          printSuccess('Daemon started');
        }
        break;
      }

      case 'stop': {
        const wasRunning = await service.isRunning();
        if (!wasRunning) {
          printInfo('Daemon not running');
        } else {
          await service.stop();
          printSuccess('Daemon stopped');
        }
        break;
      }

      case 'restart': {
        await service.restart();
        printSuccess('Daemon restarted');
        break;
      }

      case 'install': {
        const wasInstalled = await service.isInstalled();
        await service.install();
        if (wasInstalled) {
          printInfo('Daemon already installed');
        } else {
          printSuccess('Daemon installed');
        }
        break;
      }

      case 'uninstall': {
        const wasInstalled = await service.isInstalled();
        if (!wasInstalled) {
          printInfo('Daemon not installed');
        } else {
          await service.uninstall();
          printSuccess('Daemon uninstalled');
        }
        break;
      }

      default:
        printError(`Unknown action: ${action}`);
        console.log('Valid actions: status, start, stop, restart, install, uninstall');
    }
  } catch (error) {
    printError((error as Error).message);
  }

  console.log('');
}
