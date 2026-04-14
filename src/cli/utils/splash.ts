/**
 * CLI Splash Screen
 *
 * Fancy startup splash for mohs-agent.
 */

import { style, colors } from './console.js';

/**
 * Print main splash screen
 */
export function printSplash(): void {
  console.log('');
  console.log(style.cyan('    ╔══════════════════════════════════════════════════════════════════╗'));
  console.log(style.cyan('    ║') + style.bold(style.cyan('                    🦑  Mohs-agent  v1.0.0                    ')) + style.cyan('║'));
  console.log(style.cyan('    ╠══════════════════════════════════════════════════════════════════╣'));
  console.log(style.cyan('    ║') + style.dim('                      Multi-Agent AI Framework                         ') + style.cyan('║'));
  console.log(style.cyan('    ╠══════════════════════════════════════════════════════════════════╣'));
  console.log(style.cyan('    ║') + style.white('  ┌──────────────────────────────────────────────────────────┐  ') + style.cyan('║'));
  console.log(style.cyan('    ║') + style.white('  │') + style.cyan('  ✦') + style.white(' Central Orchestrator   ') + style.gray('│') + style.dim(' Multi-agent coordination hub       ') + style.white('│  ') + style.cyan('║'));
  console.log(style.cyan('    ║') + style.white('  │') + style.cyan('  ✦') + style.white(' Five-Layer Memory      ') + style.gray('│') + style.dim(' Sensory/Working/Semantic/Episodic  ') + style.white('│  ') + style.cyan('║'));
  console.log(style.cyan('    ║') + style.white('  │') + style.cyan('  ✦') + style.white(' Self-Evolution        ') + style.gray('│') + style.dim(' DreamProcessor + Reflection        ') + style.white('│  ') + style.cyan('║'));
  console.log(style.cyan('    ║') + style.white('  │') + style.cyan('  ✦') + style.white(' Subagent Router        ') + style.gray('│') + style.dim(' Context-isolated routing           ') + style.white('│  ') + style.cyan('║'));
  console.log(style.cyan('    ║') + style.white('  │') + style.cyan('  ✦') + style.white(' Gateway Protocol       ') + style.gray('│') + style.dim(' WebSocket control plane           ') + style.white('│  ') + style.cyan('║'));
  console.log(style.cyan('    ║') + style.white('  │') + style.cyan('  ✦') + style.white(' Plugin System         ') + style.gray('│') + style.dim(' Extensible hooks & channels        ') + style.white('│  ') + style.cyan('║'));
  console.log(style.cyan('    ║') + style.white('  └──────────────────────────────────────────────────────────┘  ') + style.cyan('║'));
  console.log(style.cyan('    ╠══════════════════════════════════════════════════════════════════╣'));
  console.log(style.cyan('    ║') + style.dim('  📦 Providers: ') + style.white('MiniMax') + style.gray('/') + style.white('Qwen') + style.gray('/') + style.white('Kimi') + style.gray('/') + style.white('GLM') + style.gray('/') + style.white('Claude') + style.gray('/') + style.white('GPT') + style.gray('/') + style.white('Gemini') + style.gray('/') + style.white('DeepSeek') + style.gray('/') + style.white('Ollama') + style.dim('  │  ') + style.cyan('║'));
  console.log(style.cyan('    ║') + style.dim('  💬 Channels: ') + style.white('Telegram') + style.gray('/') + style.white('Discord') + style.gray('/') + style.white('WhatsApp') + style.gray('/') + style.white('Slack') + style.gray('/') + style.white('WeChat') + style.gray('/') + style.white('Feishu') + style.gray('/') + style.white('Teams') + style.gray('/') + style.white('iMessage') + style.dim('         │  ') + style.cyan('║'));
  console.log(style.cyan('    ╚══════════════════════════════════════════════════════════════════╝'));
  console.log('');
}

/**
 * Print mini splash for sub-commands
 */
export function printMiniSplash(): void {
  console.log('');
  console.log(style.cyan('    ╭───────────────────────────────╮'));
  console.log(style.cyan('    │  ') + style.cyan('🦑') + '  ' + style.bold('Mohs-agent') + '  ' + style.dim('v1.0.0') + style.cyan('      │'));
  console.log(style.cyan('    ╰───────────────────────────────╯'));
  console.log('');
}

/**
 * Print gateway splash
 */
export function printGatewaySplash(port: number): void {
  console.log('');
  console.log(style.cyan('    ╔══════════════════════════════════════════════════════╗'));
  console.log(style.cyan('    ║') + style.bold(style.cyan('         🦑  Mohs-agent Gateway  v1.0.0               ')) + style.cyan('║'));
  console.log(style.cyan('    ╠══════════════════════════════════════════════════════╣'));
  console.log(style.cyan('    ║') + style.green('  ⚡ WebSocket Server Ready                            ') + style.cyan('║'));
  console.log(style.cyan('    ║') + style.white('     Endpoint: ') + style.yellow(`ws://localhost:${port}`) + style.white('                    ') + style.cyan('║'));
  console.log(style.cyan('    ║') + style.dim('     Press Ctrl+C to stop                              ') + style.cyan('║'));
  console.log(style.cyan('    ╚══════════════════════════════════════════════════════╝'));
  console.log('');
}
