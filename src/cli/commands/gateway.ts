/**
 * Gateway Command
 *
 * Start the WebSocket gateway server for remote agent control.
 */

import { style, printSection, printSuccess, printError, printInfo } from '../utils/console.js';
import { Gateway } from '../../protocol/gateway.js';
import { getSessionStore } from '../../sessions/index.js';

export async function gatewayCommand(args: { port?: string; host?: string }): Promise<void> {
  const port = parseInt(args.port || '18789', 10);
  const host = args.host || 'localhost';

  console.log('');
  console.log(style.bold(style.cyan('═══ Mohs Agent Gateway ═══')));
  console.log('');

  const sessionStore = getSessionStore();

  const gateway = new Gateway(
    { port, host, requireAuth: false },
    sessionStore,
    undefined
  );

  try {
    await gateway.start();
    printSuccess(`Gateway started on ${host}:${port}`);
    printInfo('Press Ctrl+C to stop');

    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\nStopping gateway...');
      await gateway.stop();
      process.exit(0);
    });
  } catch (error) {
    printError(`Failed to start gateway: ${(error as Error).message}`);
  }
}
