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
import type { InboundMessage } from '../../channels/base/types.js';
import { createTaskId, type SessionId } from '../../types/index.js';

interface StartOptions {
  webchat?: boolean;
  telegram?: boolean;
  port?: string;
  'bot-token'?: string;
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

  // Track active channels
  const activeChannels: Array<{ name: string; disconnect: () => Promise<void> }> = [];

  // Message handler factory - creates a handler for a specific channel
  const createMessageHandler = (channelName: string) => {
    return async (msg: InboundMessage): Promise<void> => {
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

        // 4. Submit task to orchestrator
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

        // 5. Get response content
        const responseContent = result.output?.content || 'No response';

        // 6. Send response back via channel
        // Note: This relies on the channel being available through closure
        printInfo(`[${channelName}] Response: ${responseContent.substring(0, 50)}...`);

        // 7. Add assistant response to transcript
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
    };
  };

  // Start WebChat if requested
  if (args.webchat) {
    printSection('Starting WebChat');

    const webchat = new WebChatChannel();
    const port = parseInt(args.port || '8080', 10);

    try {
      await webchat.initialize({ enabled: true, port });
      webchat.onMessage(createMessageHandler('WebChat'));

      // Override send to include actual delivery
      const originalSend = webchat.send.bind(webchat);
      webchat.send = async (message) => {
        const clientId = message.to;
        const client = (webchat as any).clients?.get(clientId);
        if (client && client.ws.readyState === 1) {
          client.ws.send(JSON.stringify({
            type: 'message',
            id: `msg-${Date.now()}`,
            content: message.content,
            timestamp: Date.now(),
          }));
          return `msg-${Date.now()}`;
        }
        throw new Error('Client not found or not connected');
      };

      await webchat.connect();
      activeChannels.push({ name: 'WebChat', disconnect: () => webchat.disconnect() });
      printSuccess(`WebChat started on port ${port}`);
      printInfo(`Connect via WebSocket to ws://localhost:${port}`);
    } catch (error) {
      printError(`Failed to start WebChat: ${(error as Error).message}`);
    }
  }

  // Start Telegram if requested
  if (args.telegram) {
    printSection('Starting Telegram');

    const botToken = args['bot-token'] || config?.channels?.telegram?.botToken;

    if (!botToken) {
      printError('Telegram bot token required. Use --bot-token or configure channels.telegram.botToken');
    } else {
      const telegram = new TelegramChannel();

      try {
        await telegram.initialize({ enabled: true, botToken });
        telegram.onMessage(createMessageHandler('Telegram'));
        await telegram.connect();
        activeChannels.push({ name: 'Telegram', disconnect: () => telegram.disconnect() });
        printSuccess('Telegram bot started');
        printInfo('Send /start to your bot to begin');
      } catch (error) {
        printError(`Failed to start Telegram: ${(error as Error).message}`);
      }
    }
  }

  // Check if any channel was started
  if (activeChannels.length === 0) {
    printSection('No Channels Started');
    printInfo('Use --webchat or --telegram to start a channel');
    console.log('');
    console.log(style.dim('  Options:'));
    console.log(style.dim('    --webchat              Start WebChat channel'));
    console.log(style.dim('    --telegram              Start Telegram channel'));
    console.log(style.dim('    --port <port>           WebChat port (default: 8080)'));
    console.log(style.dim('    --bot-token <token>     Telegram bot token'));
    console.log('');
    console.log(style.dim('  Example:'));
    console.log(style.dim('    mohs-agent start --webchat --port 8080'));
    console.log(style.dim('    mohs-agent start --telegram --bot-token YOUR_TOKEN'));
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
