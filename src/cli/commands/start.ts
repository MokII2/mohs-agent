/**
 * Start Command
 *
 * Start mohs-agent services (channels and orchestrator).
 */

import { style, printSection, printSuccess, printError, printInfo } from '../utils/console.js';
import { printSplash } from '../utils/splash.js';
import { getConfigLoader } from '../../config/index.js';
import { createOrchestrator, createSimpleAgent } from '../../factories.js';
import { getSessionStore } from '../../sessions/index.js';
import { WebChatChannel } from '../../channels/webchat/index.js';
import { TelegramChannel } from '../../channels/telegram/index.js';
import { SlackChannel } from '../../channels/slack/index.js';
import { DiscordChannel } from '../../channels/discord/index.js';
import { WhatsAppChannel } from '../../channels/whatsapp/index.js';
import type { InboundMessage, IChannel, OutboundMessage } from '../../channels/base/types.js';
import { createTaskId } from '../../types/index.js';

interface StartOptions {
  webchat?: boolean;
  telegram?: boolean;
  slack?: boolean;
  discord?: boolean;
  whatsapp?: boolean;
  port?: string;
  'bot-token'?: string;
  'slack-token'?: string;
  'slack-secret'?: string;
  'discord-token'?: string;
}

export async function startCommand(args: StartOptions): Promise<void> {
  printSplash();

  const configLoader = getConfigLoader();

  // Load config if needed
  if (!configLoader.isLoaded()) {
    try {
      await configLoader.load();
    } catch {
      printInfo('No config found, using defaults');
    }
  }

  const config = configLoader.get();
  const agentName = config?.agent?.name || 'Mohs Agent';

  // Create orchestrator and session store
  const orchestrator = createOrchestrator();
  const sessionStore = getSessionStore();

  // Create and register default agent
  const agent = createSimpleAgent({ name: agentName });
  orchestrator.registerAgent(agent);
  orchestrator.start();

  printSuccess(`Orchestrator started with agent: ${agentName}`);

  // Track active channels with their send functions
  const activeChannels: Array<{
    name: string;
    channel: IChannel;
    disconnect: () => Promise<void>;
  }> = [];

  // Create a map to store channel send functions for response routing
  const channelSenders = new Map<string, (msg: OutboundMessage) => Promise<string>>();

  /**
   * Handle incoming messages from any channel
   */
  async function handleIncomingMessage(msg: InboundMessage, channel: IChannel, channelName: string): Promise<void> {
    try {
      // 1. Get or create session by peerId (chat_id)
      let session = await sessionStore.getByKey(msg.peerId);
      if (!session) {
        session = await sessionStore.create({
          key: msg.peerId,
          metadata: {
            channelId: msg.channelId,
            userId: msg.senderId,
          },
        });
      }

      // 2. Add user message to transcript
      await sessionStore.addTranscriptEntry(session.id, {
        role: 'user',
        content: msg.content,
      });

      // 3. Update session activity
      await sessionStore.update(session.id, {
        status: 'active',
      });

      // 4. Send typing indicator
      const sender = channelSenders.get(channelName);
      if (sender) {
        try {
          await channel.sendTyping(msg.peerId);
        } catch {
          // Ignore typing indicator errors
        }
      }

      // 5. Submit task to orchestrator
      const task = {
        id: createTaskId(`task-${Date.now()}`),
        type: 'question',
        description: msg.content,
        input: { query: msg.content },
        createdAt: Date.now(),
      };

      const result = await orchestrator.submitTask(task, {
        sessionId: session.id,
        userId: msg.senderId,
        memory: undefined,
        skills: undefined,
        tools: undefined,
      });

      // 6. Get response content
      const responseContent = result.output?.content || 'No response';

      // 7. Send response back via channel
      const sendFn = channelSenders.get(channelName);
      if (sendFn) {
        await sendFn({
          to: msg.peerId,
          content: responseContent,
        });
        printInfo(`[${channelName}] Sent response to ${msg.senderName}`);
      } else {
        printInfo(`[${channelName}] Response: ${responseContent.substring(0, 50)}...`);
      }

      // 8. Add assistant response to transcript
      await sessionStore.addTranscriptEntry(session.id, {
        role: 'assistant',
        content: responseContent,
      });

      // Update session activity again
      await sessionStore.update(session.id, {
        status: 'idle',
      });
    } catch (error) {
      printError(`Error handling message: ${(error as Error).message}`);
    }
  }

  // Start WebChat if requested
  if (args.webchat) {
    printSection('Starting WebChat');

    const webchat = new WebChatChannel();
    const port = parseInt(args.port || '8080', 10);

    try {
      await webchat.initialize({ enabled: true, port });

      // Custom send implementation for WebChat
      const webchatSender = async (msg: OutboundMessage): Promise<string> => {
        const clientId = msg.to;
        const clients = (webchat as any).clients as Map<string, { ws: { readyState: number; send: (data: string) => void } }> | undefined;
        const client = clients?.get(clientId);
        if (client && client.ws.readyState === 1) {
          const msgId = `msg-${Date.now()}`;
          client.ws.send(JSON.stringify({
            type: 'message',
            id: msgId,
            from: 'agent',
            fromName: agentName,
            content: msg.content,
            timestamp: Date.now(),
          }));
          return msgId;
        }
        throw new Error(`Client ${clientId} not found or not connected`);
      };
      channelSenders.set('WebChat', webchatSender);

      webchat.onMessage((msg) => handleIncomingMessage(msg, webchat, 'WebChat'));
      await webchat.connect();

      activeChannels.push({ name: 'WebChat', channel: webchat, disconnect: () => webchat.disconnect() });
      printSuccess(`WebChat started on port ${port}`);
      printInfo(`Open web/index.html and connect to ws://localhost:${port}`);
    } catch (error) {
      printError(`Failed to start WebChat: ${(error as Error).message}`);
    }
  }

  // Start Telegram if requested
  if (args.telegram) {
    printSection('Starting Telegram');

    const channelConfig = config?.channels as Record<string, any> | undefined;
    const botToken = args['bot-token'] || channelConfig?.telegram?.botToken as string;

    if (!botToken) {
      printError('Telegram bot token required. Use --bot-token or configure channels.telegram.botToken');
    } else {
      const telegram = new TelegramChannel();

      try {
        await telegram.initialize({ enabled: true, botToken });
        channelSenders.set('Telegram', (msg) => telegram.send(msg));
        telegram.onMessage((msg) => handleIncomingMessage(msg, telegram, 'Telegram'));
        await telegram.connect();

        activeChannels.push({ name: 'Telegram', channel: telegram, disconnect: () => telegram.disconnect() });
        printSuccess('Telegram bot started');
        printInfo('Send /start to your bot to begin');
      } catch (error) {
        printError(`Failed to start Telegram: ${(error as Error).message}`);
      }
    }
  }

  // Start Slack if requested
  if (args.slack) {
    printSection('Starting Slack');

    const channelConfig = config?.channels as Record<string, any> | undefined;
    const botToken = args['slack-token'] || channelConfig?.slack?.botToken as string;
    const signingSecret = args['slack-secret'] || channelConfig?.slack?.signingSecret as string;

    if (!botToken || !signingSecret) {
      printError('Slack bot token and signing secret required. Use --slack-token and --slack-secret or configure channels.slack');
    } else {
      const slack = new SlackChannel();

      try {
        await slack.initialize({ enabled: true, botToken, signingSecret });
        channelSenders.set('Slack', (msg) => slack.send(msg));
        slack.onMessage((msg) => handleIncomingMessage(msg, slack, 'Slack'));
        await slack.connect();

        activeChannels.push({ name: 'Slack', channel: slack, disconnect: () => slack.disconnect() });
        printSuccess('Slack bot started');
        printInfo('Invite the bot to your channel and mention it or send /start');
      } catch (error) {
        printError(`Failed to start Slack: ${(error as Error).message}`);
      }
    }
  }

  // Start Discord if requested
  if (args.discord) {
    printSection('Starting Discord');

    const channelConfig = config?.channels as Record<string, any> | undefined;
    const botToken = args['discord-token'] || channelConfig?.discord?.botToken as string;

    if (!botToken) {
      printError('Discord bot token required. Use --discord-token or configure channels.discord.botToken');
    } else {
      const discord = new DiscordChannel();

      try {
        await discord.initialize({ enabled: true, botToken });
        channelSenders.set('Discord', (msg) => discord.send(msg));
        discord.onMessage((msg) => handleIncomingMessage(msg, discord, 'Discord'));
        await discord.connect();

        activeChannels.push({ name: 'Discord', channel: discord, disconnect: () => discord.disconnect() });
        printSuccess('Discord bot started');
        printInfo('Add the bot to your server and mention it or use /start');
      } catch (error) {
        printError(`Failed to start Discord: ${(error as Error).message}`);
      }
    }
  }

  // Start WhatsApp if requested
  if (args.whatsapp) {
    printSection('Starting WhatsApp');

    const whatsapp = new WhatsAppChannel();

    try {
      await whatsapp.initialize({ enabled: true });
      channelSenders.set('WhatsApp', (msg) => whatsapp.send(msg));
      whatsapp.onMessage((msg) => handleIncomingMessage(msg, whatsapp, 'WhatsApp'));
      await whatsapp.connect();

      activeChannels.push({ name: 'WhatsApp', channel: whatsapp, disconnect: () => whatsapp.disconnect() });
      printSuccess('WhatsApp bot started');
      printInfo('Scan the QR code with WhatsApp to link your account');
    } catch (error) {
      printError(`Failed to start WhatsApp: ${(error as Error).message}`);
    }
  }

  // Check if any channel was started
  if (activeChannels.length === 0) {
    printSection('No Channels Started');
    printInfo('Use options to start channels:');
    console.log('');
    console.log(style.dim('  Options:'));
    console.log(style.dim('    --webchat              Start WebChat (WebSocket)'));
    console.log(style.dim('    --telegram             Start Telegram bot'));
    console.log(style.dim('    --slack                Start Slack bot'));
    console.log(style.dim('    --discord              Start Discord bot'));
    console.log(style.dim('    --whatsapp             Start WhatsApp bot'));
    console.log(style.dim(''));
    console.log(style.dim('  Channel Options:'));
    console.log(style.dim('    --port <port>          WebChat port (default: 8080)'));
    console.log(style.dim('    --bot-token <token>    Telegram bot token'));
    console.log(style.dim('    --slack-token <token>  Slack bot token'));
    console.log(style.dim('    --slack-secret <sec>   Slack signing secret'));
    console.log(style.dim('    --discord-token <tok>  Discord bot token'));
    console.log('');
    console.log(style.dim('  Example:'));
    console.log(style.dim('    mohs-agent start --webchat'));
    console.log(style.dim('    mohs-agent start --telegram --bot-token YOUR_TOKEN'));
    console.log(style.dim('    mohs-agent start --webchat --telegram --whatsapp'));
    console.log('');
    return;
  }

  // Keep process alive
  printSection('Services Running');
  printSuccess(`Started ${activeChannels.length} channel(s): ${activeChannels.map(c => c.name).join(', ')}`);
  console.log('');
  printInfo('Press Ctrl+C to stop');
  console.log('');

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    for (const channel of activeChannels) {
      try {
        await channel.disconnect();
        printSuccess(`${channel.name} disconnected`);
      } catch {
        // Ignore errors during shutdown
      }
    }
    process.exit(0);
  });
}
