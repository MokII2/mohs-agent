/**
 * CLI Entry Point
 *
 * Main CLI entry for mohs-agent.
 */

import { Command } from 'commander';
import {
  statusCommand,
  healthCommand,
  sessionsCommand,
  configCommand,
  daemonCommand,
  setupCommand,
  gatewayCommand,
  startCommand,
} from './commands/index.js';
import { style } from './utils/console.js';
import { printSplash } from './utils/splash.js';

/**
 * Create the CLI program
 */
export function createCLI(): Command {
  const program = new Command();

  program
    .name('mohs-agent')
    .description('AI Agent Framework CLI')
    .version('1.0.0');

  // Setup command
  program
    .command('setup')
    .description('Initial setup for mohs-agent')
    .action(setupCommand);

  // Status command
  program
    .command('status')
    .description('Show mohs-agent status')
    .action(statusCommand);

  // Health command
  program
    .command('health')
    .description('Show mohs-agent health check')
    .action(healthCommand);

  // Sessions command
  program
    .command('sessions')
    .description('List and manage sessions')
    .option('-l, --list', 'List all sessions')
    .option('-i, --id <id>', 'Get session by ID')
    .option('-d, --delete <id>', 'Delete session by ID')
    .action(sessionsCommand);

  // Config command
  program
    .command('config')
    .description('View and manage configuration')
    .option('-l, --list', 'List all config')
    .option('-g, --get <key>', 'Get config value')
    .option('-s, --set <key=value>', 'Set config value')
    .action(configCommand);

  // Daemon command
  program
    .command('daemon')
    .description('Manage mohs-agent daemon service')
    .option('-a, --action <action>', 'Action: status, start, stop, restart, install, uninstall')
    .action(daemonCommand);

  // Gateway command
  program
    .command('gateway')
    .description('Start WebSocket gateway server for remote control')
    .option('-p, --port <port>', 'Port to listen on', '18789')
    .option('-h, --host <host>', 'Host to bind to', 'localhost')
    .action(gatewayCommand);

  // Start command
  program
    .command('start')
    .description('Start mohs-agent channels and services')
    .option('--webchat', 'Start WebChat channel')
    .option('--telegram', 'Start Telegram channel')
    .option('--port <port>', 'WebChat port', '8080')
    .option('--bot-token <token>', 'Telegram bot token')
    .action(startCommand);

  // Agent command
  program
    .command('agent')
    .description('Run agent interactively')
    .argument('[message]', 'Initial message to send')
    .action(async (message) => {
      if (message) {
        console.log(style.cyan('Agent: '), message);
      } else {
        console.log('Interactive agent mode (not implemented)');
      }
    });

  // Message command
  program
    .command('message')
    .description('Send a message to a session')
    .argument('<session>', 'Session ID or key')
    .argument('<text>', 'Message text')
    .action(async (session, text) => {
      console.log(`Sending to ${session}: ${text}`);
      // In full implementation, would send via gateway
    });

  return program;
}

/**
 * Main entry point
 */
export async function entry(args: string[] = process.argv): Promise<void> {
  // Load config on startup
  try {
    const { getConfigLoader } = await import('../config/index.js');
    const configLoader = getConfigLoader();
    await configLoader.load();
  } catch {
    // Config might not exist yet, that's ok
  }

  // Show splash for primary commands
  const cmd = args[2]; // args[0] = node, args[1] = script
  const splashCommands = ['status', 'health', 'sessions', 'config', 'daemon', 'gateway', 'setup', 'agent', 'start'];

  if (splashCommands.includes(cmd)) {
    printSplash();
  }

  const program = createCLI();
  await program.parseAsync(args);
}

// Run if this is the main module
entry().catch((error) => {
  console.error(style.red('Error:'), error.message);
  process.exit(1);
});
