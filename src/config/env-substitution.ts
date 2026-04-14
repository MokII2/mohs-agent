/**
 * Environment Variable Substitution
 *
 * Handles ${VAR} and $VAR substitution in config values.
 */

/**
 * Substitute environment variables in a string value
 */
export function substituteEnvVars(value: string, env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): string {
  // Match ${VAR} or $VAR patterns
  const pattern = /\$\{([A-Z_][A-Z0-9_]*)\}|\$([A-Z_][A-Z0-9_]*)/g;

  return value.replace(pattern, (match, braced, unbraced) => {
    const varName = braced || unbraced;
    const envValue = env[varName];

    if (envValue === undefined) {
      // Return original if not found, or empty string depending on strictness
      console.warn(`[Config] Environment variable ${varName} not found, keeping original`);
      return match;
    }

    return envValue;
  });
}

/**
 * Recursively substitute env vars in an object
 */
export function substituteEnvVarsDeep<T>(obj: T, env?: Record<string, string | undefined>): T {
  if (typeof obj === 'string') {
    return substituteEnvVars(obj, env) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => substituteEnvVarsDeep(item, env)) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = substituteEnvVarsDeep(value, env);
    }
    return result as T;
  }

  return obj;
}

/**
 * Check if a string contains env var references
 */
export function containsEnvVars(value: string): boolean {
  return /\$\{[^}]+\}|\$[A-Z_][A-Z0-9_]*/.test(value);
}

/**
 * Extract env var names from a string
 */
export function extractEnvVars(value: string): string[] {
  const pattern = /\$\{([A-Z_][A-Z0-9_]*)\}|\$([A-Z_][A-Z0-9_]*)/g;
  const vars: string[] = [];
  let match;

  while ((match = pattern.exec(value)) !== null) {
    vars.push(match[1] || match[2]);
  }

  return [...new Set(vars)];
}
