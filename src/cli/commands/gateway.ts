/**
 * Gateway Command
 *
 * Start the WebSocket gateway server for remote agent control.
 */

import { style, printSuccess, printError } from '../utils/console.js';
import { printGatewaySplash } from '../utils/splash.js';
import { Gateway } from '../../protocol/gateway.js';
import { getSessionStore } from '../../sessions/index.js';

export async function gatewayCommand(args: { port?: string; host?: string }): Promise<void> {
  const port = parseInt(args.port || '18888', 10);
  const host = args.host || 'localhost';

  printGatewaySplash(port);

  const sessionStore = getSessionStore();

  const gateway = new Gateway(
    { port, host, requireAuth: false },
    sessionStore,
    undefined
  );

  try {
    await gateway.start();
    printSuccess(`Gateway started on ${host}:${port}`);

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
