/**
 * Health Command
 *
 * Show mohs-agent health check.
 */

import { style, printSection, printKeyValue, printSuccess, printError, printWarning, printInfo } from '../utils/console.js';

export async function healthCommand(): Promise<void> {
  console.log('');
  console.log(style.bold(style.cyan('═══ Mohs Agent Health ═══')));
  console.log('');

  let overallHealthy = true;

  // Check memory/DB
  printSection('Memory');
  try {
    const { getConfigLoader } = await import('../../config/index.js');
    const config = getConfigLoader().get();
    if (config.memory?.chromaPath) {
      printSuccess(` ChromaDB: ${config.memory.chromaPath}`);
    } else {
      printWarning(' ChromaDB: not configured');
    }
  } catch (error) {
    printError(` ChromaDB: ${(error as Error).message}`);
    overallHealthy = false;
  }

  // Check providers
  printSection('Providers');
  try {
    const { providerRegistry } = await import('../../providers/index.js');
    const providers = providerRegistry.getAvailable();
    const allProviders = providerRegistry.getAll();

    if (providers.length > 0) {
      printSuccess(` ${providers.length}/${allProviders.length} providers healthy`);
    } else if (allProviders.length > 0) {
      printWarning(` ${providers.length}/${allProviders.length} providers available (check API keys)`);
    } else {
      printError(' No providers configured');
      overallHealthy = false;
    }
  } catch (error) {
    printError(` Providers: ${(error as Error).message}`);
    overallHealthy = false;
  }

  // Check channels
  printSection('Channels');
  try {
    const { channelRegistry } = await import('../../channels/index.js');
    const registry = channelRegistry;
    const channels = registry.getAll();

    if (channels.length > 0) {
      const enabled = channels.filter((c) => c.getStatus().connected).length;
      printSuccess(` ${enabled}/${channels.length} channels enabled`);
    } else {
      printInfo(' No channels configured');
    }
  } catch (error) {
    printWarning(` Channels: ${(error as Error).message}`);
  }

  console.log('');
  console.log(style.bold('Overall: ') + (overallHealthy ? style.green('HEALTHY') : style.red('UNHEALTHY')));
  console.log('');
}
