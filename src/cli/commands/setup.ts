/**
 * Setup Command
 *
 * Initial setup for mohs-agent.
 */

import { style, printSection, printSuccess, printError, printInfo, printWarning } from '../utils/console.js';
import { question, password, select } from '../utils/prompts.js';
import { getConfigLoader } from '../../config/index.js';

export async function setupCommand(): Promise<void> {
  console.log('');
  console.log(style.bold(style.cyan('╔═══════════════════════════════════════════════════════════╗')));
  console.log(style.bold(style.cyan('║              🦑  Mohs Agent - Initial Setup                ║')));
  console.log(style.bold(style.cyan('╚═══════════════════════════════════════════════════════════╝')));
  console.log('');

  const configLoader = getConfigLoader();

  // ========================
  // Agent Configuration
  // ========================
  printSection('1. Agent Configuration');
  const agentName = await question('Agent name', { default: 'Mohs Agent' });
  const agentId = await question('Agent ID', { default: agentName.toLowerCase().replace(/\s+/g, '-') });

  // ========================
  // Model Selection
  // ========================
  printSection('2. Model Configuration');
  const { providerRegistry } = await import('../../providers/index.js');

  const allModels = providerRegistry.getAllSupportedModels();

  let selectedProviderId: string = '';
  let selectedProvider: { name: string; supportedModels: string[] } | undefined;
  let selectedModel: string = '';
  let apiKey = '';

  if (allModels.length > 0) {
    console.log(style.dim('\n  Available Providers:'));
    console.log('');

    for (const provider of allModels) {
      const available = providerRegistry.get(provider.providerId)?.isAvailable();
      const status = available ? style.green('●') : style.red('○');
      console.log(style.cyan(`  ${status}  ${style.white(provider.providerName)}`));
      console.log(style.dim(`      Models: ${provider.models.slice(0, 5).join(', ')}${provider.models.length > 5 ? '...' : ''}`));
      console.log('');
    }

    const providerOptions = allModels.map((p) => ({
      label: `${p.providerName} (${p.models.length} models)`,
      value: p.providerId,
    }));

    selectedProviderId = await select('Select default provider:', providerOptions);
    selectedProvider = providerRegistry.get(selectedProviderId);

    console.log(style.dim(`\n  Provider: ${style.white(selectedProvider?.name || selectedProviderId)}`));
    console.log(style.dim(`  Models: ${selectedProvider?.supportedModels.join(', ')}`));

    // Select specific model
    const modelOptions = selectedProvider?.supportedModels.map((m) => ({
      label: m,
      value: m,
    })) || [];

    selectedModel = await select('Select default model:', modelOptions);
    printSuccess(`Selected model: ${selectedModel}`);

    // ========================
    // API Key (if needed)
    // ========================
    if (!providerRegistry.get(selectedProviderId)?.isAvailable()) {
      printSection('3. API Configuration');
      printInfo('This provider requires an API key:');
      apiKey = await password('API Key');
    }
  } else {
    printWarning('No providers found. Configure API keys manually.');
  }

  // ========================
  // Channel Selection
  // ========================
  printSection('3. Channel Configuration');
  const { channelRegistry } = await import('../../channels/index.js');
  const channels = channelRegistry.getAll();

  if (channels.length > 0) {
    console.log(style.dim('\n  Available Channels:'));
    for (const channel of channels) {
      const status = channel.getStatus().connected ? style.green('●') : style.red('○');
      console.log(style.cyan(`  ${status}  ${style.white(channel.name)}`));
    }
  } else {
    console.log(style.dim('  No built-in channels. Add channels via plugins.'));
  }

  // ========================
  // Memory Configuration
  // ========================
  printSection('4. Memory Configuration');
  console.log(style.dim('  Five-Layer Memory Architecture:'));
  console.log(style.dim('    • Sensory    - Raw conversation input (183 days)'));
  console.log(style.dim('    • Working    - Current task context (20 msgs / 7 days)'));
  console.log(style.dim('    • Semantic   - Vector embeddings via ChromaDB'));
  console.log(style.dim('    • Episodic   - Monthly conversation archives (12 months)'));
  console.log(style.dim('    • Experience - Trial/error outcomes (500 entries / 90 days)'));

  const useChroma = await question('Enable ChromaDB for Semantic layer?', { default: 'Y/n' });
  const chromaPath = useChroma.toLowerCase().startsWith('y') || useChroma === ''
    ? await question('ChromaDB path', { default: './chroma-db' })
    : '';

  // ========================
  // Gateway Configuration
  // ========================
  printSection('5. Gateway Configuration');
  const enableGateway = await question('Enable Gateway (WebSocket control plane)?', { default: 'Y/n' });
  const gatewayPort = enableGateway.toLowerCase().startsWith('y') || enableGateway === ''
    ? await question('Gateway port', { default: '18888' })
    : '18888';

  // ========================
  // Save Configuration
  // ========================
  printSection('Saving Configuration');

  try {
    const config: Record<string, unknown> = {
      version: '1.0.0',
      agent: {
        id: agentId,
        name: agentName,
      },
    };

    // Add provider config if selected
    if (selectedProviderId) {
      config.providers = {
        [selectedProviderId]: {
          apiKey: apiKey || undefined,
          defaultModel: selectedModel,
        },
      };
    }

    // Add memory config
    if (chromaPath) {
      config.memory = {
        enabledLayers: ['sensory', 'working', 'semantic', 'episodic', 'experience'],
        chromaPath: chromaPath,
      };
    }

    // Add daemon/gateway config
    if (enableGateway.toLowerCase().startsWith('y') || enableGateway === '') {
      config.daemon = {
        enabled: true,
        port: parseInt(gatewayPort, 10),
      };
    }

    await configLoader.update(config);
    printSuccess('Configuration saved to ~/.mohs-agent/config.json');

    console.log('');
    console.log(style.bold(style.green('  ✓ Setup complete!')));
    console.log('');
    console.log(style.dim('  Next steps:'));
    console.log(style.dim('    • Run ') + style.white('mohs-agent status') + style.dim(' to verify setup'));
    console.log(style.dim('    • Run ') + style.white('mohs-agent gateway') + style.dim(' to start WebSocket server'));
    console.log(style.dim('    • Set API keys in config or environment variables'));
    console.log('');
  } catch (error) {
    printError(`Failed to save config: ${(error as Error).message}`);
  }
}
