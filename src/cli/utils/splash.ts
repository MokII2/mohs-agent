/**
 * CLI Splash Screen
 *
 * Fancy startup splash for mohs-agent.
 */

import { style } from './console.js';

/**
 * Print main splash screen
 */
export function printSplash(): void {
  console.log('');
  console.log(style.cyan('  =============================================================='));
  console.log(style.cyan('  ||') + '                                                           ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '     ' + style.bold(style.cyan('M') + style.cyan('ohs-agent')) + '  ' + style.dim('v1.0.0') + '                                          ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '     ' + style.dim('Multi-Agent AI Framework') + '                               ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '                                                           ' + style.cyan('||'));
  console.log(style.cyan('  =============================================================='));
  console.log(style.cyan('  ||') + '                                                           ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '  ' + style.white('Core Features:') + '                                                ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '                                                           ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '  ' + style.cyan('>') + '  ' + style.white('Central Orchestrator') + '  |  ' + style.dim('Multi-agent coordination hub') + '           ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '  ' + style.cyan('>') + '  ' + style.white('Five-Layer Memory') + '     |  ' + style.dim('Sensory/Working/Semantic/Episodic') + '  ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '  ' + style.cyan('>') + '  ' + style.white('Self-Evolution') + '      |  ' + style.dim('DreamProcessor + Reflection') + '            ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '  ' + style.cyan('>') + '  ' + style.white('Subagent Router') + '      |  ' + style.dim('Context-isolated routing') + '               ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '  ' + style.cyan('>') + '  ' + style.white('Gateway Protocol') + '     |  ' + style.dim('WebSocket control plane') + '                  ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '  ' + style.cyan('>') + '  ' + style.white('Plugin System') + '       |  ' + style.dim('Extensible hooks & channels') + '             ' + style.cyan('||'));
  console.log(style.cyan('  ||') + '                                                           ' + style.cyan('||'));
  console.log(style.cyan('  =============================================================='));
  console.log('');
}

/**
 * Print mini splash for sub-commands
 */
export function printMiniSplash(): void {
  console.log('');
  console.log(style.cyan('  [Mohs-agent v1.0.0]'));
  console.log('');
}
