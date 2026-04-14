/**
 * File-based Secret Source
 *
 * Resolves secrets from files.
 */

import { readFile } from 'fs/promises';
import type { FileSecretRef, SecretValue } from '../types.js';

/**
 * Resolve a secret from a file
 */
export async function resolveFileSecret(ref: FileSecretRef): Promise<string | null> {
  try {
    const content = await readFile(ref.path, ref.encoding || 'utf8');

    if (ref.key) {
      // Parse as JSON and extract key
      const parsed = JSON.parse(content);
      const value = parsed[ref.key];
      return typeof value === 'string' ? value : JSON.stringify(value);
    }

    return content.trim();
  } catch (error) {
    console.error(`[FileSecretSource] Failed to read secret from ${ref.path}:`, error);
    return null;
  }
}

/**
 * Create SecretValue from file
 */
export async function resolveFileSecretValue(ref: FileSecretRef): Promise<SecretValue | null> {
  const value = await resolveFileSecret(ref);

  if (value === null) {
    return null;
  }

  return {
    value,
    source: 'file',
    key: ref.key || ref.path,
    resolvedAt: Date.now(),
  };
}

/**
 * Check if a secret file exists and is readable
 */
export async function isFileSecretAccessible(ref: FileSecretRef): Promise<boolean> {
  try {
    await readFile(ref.path, ref.encoding || 'utf8');
    return true;
  } catch {
    return false;
  }
}
