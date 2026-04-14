/**
 * Executable-based Secret Source
 *
 * Resolves secrets by executing commands.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import type { ExecSecretRef, SecretValue } from '../types.js';

const execFileAsync = promisify(execFile);

/**
 * Resolve a secret by executing a command
 */
export async function resolveExecSecret(ref: ExecSecretRef): Promise<string | null> {
  const timeout = ref.timeoutMs || 5000;

  try {
    const { stdout, stderr } = await execFileAsync(ref.command, ref.args || [], {
      env: { ...process.env, ...ref.env },
      timeout,
    });

    if (stderr) {
      console.warn(`[ExecSecretSource] Command ${ref.command} wrote to stderr:`, stderr);
    }

    const output = stdout;

    if (ref.parse === 'json') {
      try {
        const parsed = JSON.parse(output);
        return typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
      } catch {
        console.error(`[ExecSecretSource] Failed to parse JSON from ${ref.command}`);
        return null;
      }
    }

    // Default: return trimmed stdout
    return output.trim();
  } catch (error) {
    console.error(`[ExecSecretSource] Command failed: ${ref.command}`, error);
    return null;
  }
}

/**
 * Create SecretValue from exec command
 */
export async function resolveExecSecretValue(ref: ExecSecretRef): Promise<SecretValue | null> {
  const value = await resolveExecSecret(ref);

  if (value === null) {
    return null;
  }

  return {
    value,
    source: 'exec',
    key: ref.command,
    resolvedAt: Date.now(),
  };
}

/**
 * Check if a command exists and is executable
 */
export async function isExecSecretAvailable(ref: ExecSecretRef): Promise<boolean> {
  try {
    await execFileAsync('which', [ref.command]);
    return true;
  } catch {
    return false;
  }
}
