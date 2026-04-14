/**
 * Setup Command
 *
 * Initial setup for mohs-agent.
 */

import { style, printSection, printSuccess, printError, printInfo, printWarning } from '../utils/console.js';
import { question, password, confirm } from '../utils/prompts.js';
import { getConfigLoader } from '../../config/index.js';
import { getSecretResolver } from '../../secrets/index.js';

export async function setupCommand(): Promise<void> {
  console.log('');
  console.log(style.bold(style.cyan('╔══════════════════════════════════════╗')));
  console.log(style.bold(style.cyan('║     Mohs Agent - Initial Setup       ║')));
  console.log(style.bold(style.cyan('╚══════════════════════════════════════╝')));
  console.log('');

  const configLoader = getConfigLoader();

  // Agent name
  printSection('Agent Configuration');
  const agentName = await question('Agent name', { default: 'Mohs Agent' });
  const agentId = await question('Agent ID', { default: agentName.toLowerCase().replace(/\s+/g, '-') });

  // Model selection
  printSection('Model Configuration');
  printInfo('Select default model provider:');
  const { providerRegistry } = await import('../../providers/index.js');

  const providers = providerRegistry.getAll();
  const providerOptions = providers.map((p) => ({
    label: `${p.name} (${p.supportedModels.length} models)`,
    value: p.id,
  }));

  if (providerOptions.length > 0) {
    const selectedProvider = await import('../utils/prompts.js').then((m) =>
      m.select('Provider:', providerOptions)
    );

    const provider = providerRegistry.get(selectedProvider);
    if (provider) {
      printSuccess(`Selected: ${provider.name}`);
    }
  } else {
    printWarning('No providers available. Configure API keys manually.');
  }

  // API Key
  printSection('API Configuration');
  const apiKey = await password('API Key (optional)');

  // Save config
  printSection('Saving Configuration');
  try {
    const config = {
      version: '1.0.0',
      agent: {
        id: agentId,
        name: agentName,
      },
    };

    await configLoader.update(config);
    printSuccess('Configuration saved');

    printInfo('Run "mohs-agent status" to verify setup');
  } catch (error) {
    printError(`Failed to save config: ${(error as Error).message}`);
  }

  console.log('');
}
