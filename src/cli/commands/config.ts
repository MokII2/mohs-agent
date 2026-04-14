/**
 * Config Command
 *
 * View and manage configuration.
 */

import { style, printSection, printKeyValue, printSuccess, printError, printInfo } from '../utils/console.js';
import { getConfigLoader, redactConfig } from '../../config/index.js';

export async function configCommand(args: { get?: string; set?: string; list?: boolean }): Promise<void> {
  const configLoader = getConfigLoader();

  // Load config if not loaded
  if (!configLoader.isLoaded()) {
    try {
      await configLoader.load();
    } catch (error) {
      printError(`Failed to load config: ${(error as Error).message}`);
      return;
    }
  }

  if (args.list || (!args.get && !args.set)) {
    // List all config
    console.log('');
    console.log(style.bold(style.cyan('═══ Configuration ═══')));
    console.log('');

    const config = configLoader.get();
    const redacted = redactConfig(config);

    console.log(JSON.stringify(redacted, null, 2));
    console.log('');
  } else if (args.get) {
    // Get specific value - access nested property via path
    const config = configLoader.get();
    const keys = (args.get as string).split('.');
    let value: any = config;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        value = undefined;
        break;
      }
    }
    console.log(value);
  } else if (args.set) {
    // Set value (format: key=value)
    const [key, ...valueParts] = args.set.split('=');
    const value = valueParts.join('=');

    if (!key || value === undefined) {
      printError('Invalid format. Use: config set key=value');
      return;
    }

    try {
      await configLoader.update({ [key]: value });
      printSuccess(`Updated ${key}`);
    } catch (error) {
      printError(`Failed to update config: ${(error as Error).message}`);
    }
  }
}
