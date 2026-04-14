/**
 * Sessions Command
 *
 * List and manage sessions.
 */

import { style, printSection, printKeyValue, printTableHeader, printTableRow, printSuccess, printError } from '../utils/console.js';
import { getSessionStore } from '../../sessions/index.js';
import { displaySessionKey } from '../../sessions/key-resolver.js';

export async function sessionsCommand(args: { list?: boolean; id?: string; delete?: boolean }): Promise<void> {
  const sessionStore = getSessionStore();

  if (args.list || (!args.id && !args.delete)) {
    // List sessions
    console.log('');
    console.log(style.bold(style.cyan('═══ Sessions ═══')));
    console.log('');

    const sessions = await sessionStore.list({ limit: 50 });

    if (sessions.length === 0) {
      printSuccess(' No active sessions');
      return;
    }

    const widths = [12, 30, 20];
    printTableHeader(['Session ID', 'Key', 'Last Activity'], widths);

    for (const session of sessions) {
      const id = displaySessionKey(session.id, 12);
      const key = displaySessionKey(session.key, 30);
      const lastActivity = new Date(session.lastActivityAt).toLocaleString();
      printTableRow([id, key, lastActivity], widths);
    }

    console.log('');
    console.log(style.dim(`Total: ${sessions.length} session(s)`));
  } else if (args.id) {
    // Get specific session
    const session = await sessionStore.getByKey(args.id) || await sessionStore.get(args.id as any);

    if (!session) {
      printError(`Session not found: ${args.id}`);
      return;
    }

    console.log('');
    console.log(style.bold(style.cyan(`═══ Session: ${session.id} ═══`)));
    console.log('');

    printKeyValue('Key', session.key);
    printKeyValue('Status', session.status);
    printKeyValue('Created', new Date(session.createdAt).toLocaleString());
    printKeyValue('Last Activity', new Date(session.lastActivityAt).toLocaleString());
    printKeyValue('Messages', session.transcript.length.toString());

    if (session.model) {
      printKeyValue('Model', session.model);
    }

    console.log('');
  } else if (args.delete) {
    // Delete session
    try {
      await sessionStore.delete(args.delete as any);
      printSuccess('Session deleted');
    } catch {
      printError('Session not found or already deleted');
    }
  }
}
