/**
 * Status Command
 *
 * Show mohs-agent status.
 */

import { style, printSection, printKeyValue, printSuccess, printError, printInfo } from '../utils/console.js';
import { getSessionStore } from '../../sessions/index.js';
import { getConfigLoader } from '../../config/index.js';

export async function statusCommand(): Promise<void> {
  console.log('');
  console.log(style.bold(style.cyan('═══ Mohs Agent Status ═══')));
  console.log('');

  // Config status
  try {
    const configLoader = getConfigLoader();
    if (configLoader.isLoaded()) {
      const config = configLoader.get();
      printSection('Agent');
      printKeyValue('Name', config.agent.name);
      printKeyValue('ID', config.agent.id);
      printKeyValue('Model', config.agent.model || 'default');
    } else {
      printInfo('Config not loaded');
    }
  } catch (error) {
    printError(`Config error: ${(error as Error).message}`);
  }

  // Session status
  try {
    const sessionStore = getSessionStore();
    const sessionCount = await sessionStore.count();

    printSection('Sessions');
    printKeyValue('Active Sessions', sessionCount.toString());
  } catch (error) {
    printError(`Session error: ${(error as Error).message}`);
  }

  // Provider status
  printSection('Providers');
  try {
    const { providerRegistry } = await import('../../providers/index.js');
    const providers = providerRegistry.getAvailable();

    if (providers.length > 0) {
      printSuccess(` ${providers.length} provider(s) available`);
      for (const provider of providers) {
        printKeyValue(`  ${provider.name}`, '✓');
      }
    } else {
      printInfo(' No providers configured');
    }
  } catch (error) {
    printError(`Provider error: ${(error as Error).message}`);
  }

  console.log('');
}
