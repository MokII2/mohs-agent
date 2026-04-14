/**
 * Session Key Resolver
 *
 * Resolves and parses session keys.
 */

/**
 * Session key format:
 * - Simple: sessionId
 * - Composite: userId:channelId:sessionId
 * - With workspace: userId:workspacePath:sessionId
 */

/**
 * Parse a session key
 */
export function parseSessionKey(key: string): {
  userId?: string;
  channelId?: string;
  workspacePath?: string;
  sessionId?: string;
} {
  const parts = key.split(':');

  if (parts.length === 1) {
    // Simple sessionId
    return { sessionId: parts[0] };
  }

  if (parts.length === 2) {
    // userId:sessionId
    return { userId: parts[0], sessionId: parts[1] };
  }

  if (parts.length === 3) {
    // userId:channelId:sessionId or userId:workspacePath:sessionId
    if (parts[1].startsWith('/') || parts[1].includes('/')) {
      return { userId: parts[0], workspacePath: parts[1], sessionId: parts[2] };
    }
    return { userId: parts[0], channelId: parts[1], sessionId: parts[2] };
  }

  // For longer paths, assume first is userId and rest is sessionId
  return { userId: parts[0], sessionId: parts.slice(1).join(':') };
}

/**
 * Create a session key from components
 */
export function createSessionKey(
  options:
    | { sessionId: string }
    | { userId: string; sessionId: string }
    | { userId: string; channelId: string; sessionId: string }
    | { userId: string; workspacePath: string; sessionId: string }
): string {
  if ('sessionId' in options && Object.keys(options).length === 1) {
    return options.sessionId;
  }

  if ('userId' in options && 'sessionId' in options && !('channelId' in options) && !('workspacePath' in options)) {
    return `${options.userId}:${options.sessionId}`;
  }

  if ('userId' in options && 'channelId' in options && 'sessionId' in options) {
    return `${options.userId}:${options.channelId}:${options.sessionId}`;
  }

  if ('userId' in options && 'workspacePath' in options && 'sessionId' in options) {
    return `${options.userId}:${options.workspacePath}:${options.sessionId}`;
  }

  throw new Error('Invalid session key options');
}

/**
 * Check if a session key is valid format
 */
export function isValidSessionKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  if (key.length > 512) return false;

  // Should not contain whitespace
  if (/\s/.test(key)) return false;

  // Should not be empty parts
  const parts = key.split(':');
  return parts.every((part) => part.length > 0);
}

/**
 * Get a display-friendly version of the key
 */
export function displaySessionKey(key: string, maxLength = 32): string {
  if (key.length <= maxLength) return key;

  const parsed = parseSessionKey(key);

  if (parsed.sessionId) {
    const id = parsed.sessionId;
    if (id.length > maxLength - 3) {
      return `...${id.slice(-(maxLength - 3))}`;
    }
  }

  return key.slice(0, maxLength - 3) + '...';
}
