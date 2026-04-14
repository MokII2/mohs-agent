/**
 * Config Redaction
 *
 * Redacts sensitive values from config for logging/display.
 */

const REDACTED_SENTINEL = '__MOHS_REDACTED__';

const SENSITIVE_KEYS = new Set([
  'apiKey',
  'apiSecret',
  'botToken',
  'webhookSecret',
  'password',
  'secret',
  'token',
  'privateKey',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'authToken',
]);

/**
 * Check if a key name suggests sensitive content
 */
export function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.has(key) ||
    lowerKey.includes('secret') ||
    lowerKey.includes('password') ||
    lowerKey.includes('token') ||
    lowerKey.includes('key') && (lowerKey.includes('api') || lowerKey.includes('private'));
}

/**
 * Redact sensitive values from an object
 */
export function redactConfig<T>(obj: T, depth = 0, maxDepth = 10): T {
  if (depth > maxDepth) return obj;

  if (typeof obj === 'string') {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactConfig(item, depth + 1, maxDepth)) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (isSensitiveKey(key) && typeof value === 'string') {
        result[key] = REDACTED_SENTINEL;
      } else if (value !== null && typeof value === 'object') {
        result[key] = redactConfig(value, depth + 1, maxDepth);
      } else {
        result[key] = value;
      }
    }
    return result as T;
  }

  return obj;
}

/**
 * Check if a value is the redacted sentinel
 */
export function isRedacted(value: unknown): boolean {
  return value === REDACTED_SENTINEL;
}

/**
 * Create a redaction-safe snapshot for logging
 */
export function createRedactedSnapshot<T>(obj: T): T {
  return redactConfig(obj);
}

/**
 * Format redacted config for display
 */
export function formatRedactedConfig<T>(obj: T, indent = 2): string {
  const redacted = redactConfig(obj);
  return JSON.stringify(redacted, null, indent);
}
