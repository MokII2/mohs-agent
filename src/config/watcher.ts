/**
 * Config File Watcher
 *
 * Watches config files for changes and triggers reloads.
 */

import { watch, FSWatcher } from 'fs';
import { stat } from 'fs/promises';
import { extname } from 'path';

export type ConfigChangeHandler = (path: string, eventType: 'change' | 'rename') => void;

/**
 * File watcher for config files
 */
export class ConfigWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private handlers: ConfigChangeHandler[] = [];
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private debounceMs = 100;

  /**
   * Watch a config file for changes
   */
  async watchFile(path: string): Promise<void> {
    if (this.watchers.has(path)) {
      return;
    }

    try {
      await stat(path);
    } catch {
      console.warn(`[ConfigWatcher] File not found: ${path}`);
      return;
    }

    const watcher = watch(path, { persistent: false }, (eventType, filename) => {
      if (eventType === 'change' || eventType === 'rename') {
        this.handleChange(path, eventType as 'change' | 'rename');
      }
    });

    watcher.on('error', (error) => {
      console.error(`[ConfigWatcher] Error watching ${path}:`, error);
    });

    this.watchers.set(path, watcher);
    console.log(`[ConfigWatcher] Watching: ${path}`);
  }

  /**
   * Watch a directory for config file changes
   */
  async watchDirectory(dirPath: string, extensions: string[] = ['.json', '.yaml', '.yml']): Promise<void> {
    const { readdir } = await import('fs/promises');

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && extensions.includes(extname(entry.name))) {
          await this.watchFile(`${dirPath}/${entry.name}`);
        }
      }
    } catch (error) {
      console.warn(`[ConfigWatcher] Directory not found: ${dirPath}`);
    }
  }

  /**
   * Register a change handler
   */
  onchange(handler: ConfigChangeHandler): void {
    this.handlers.push(handler);
  }

  /**
   * Handle file change with debouncing
   */
  private handleChange(path: string, eventType: 'change' | 'rename'): void {
    // Debounce rapid changes
    const existingTimer = this.debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(path);
      console.log(`[ConfigWatcher] Config changed: ${path}`);

      for (const handler of this.handlers) {
        try {
          handler(path, eventType);
        } catch (error) {
          console.error(`[ConfigWatcher] Handler error:`, error);
        }
      }
    }, this.debounceMs);

    this.debounceTimers.set(path, timer);
  }

  /**
   * Stop watching all files
   */
  close(): void {
    for (const [path, watcher] of this.watchers) {
      watcher.close();
      console.log(`[ConfigWatcher] Stopped watching: ${path}`);
    }
    this.watchers.clear();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}
