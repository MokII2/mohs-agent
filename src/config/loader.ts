/**
 * Config Loader
 *
 * Loads, validates, and watches configuration files.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { Config, ConfigSchema, ConfigUpdate } from './schema.js';
import { substituteEnvVarsDeep } from './env-substitution.js';
import { redactConfig, formatRedactedConfig } from './redaction.js';
import { ConfigWatcher } from './watcher.js';

const DEFAULT_CONFIG_PATHS = [
  './config.json',
  './config.yaml',
  './config.yml',
  './mohs-agent.json',
  './mohs-agent.yaml',
  '~/.mohs-agent/config.json',
];

const CONFIG_DIR = '~/.mohs-agent';

/**
 * Config Loader
 */
export class ConfigLoader {
  private config: Config | null = null;
  private watcher?: ConfigWatcher;
  private watchersEnabled: boolean = false;

  /**
   * Get default config path
   */
  private getDefaultPath(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '.';
    return join(home, '.mohs-agent', 'config.json');
  }

  /**
   * Load config from file
   */
  async load(path?: string): Promise<Config> {
    const configPath = path || this.getDefaultPath();

    try {
      const content = await readFile(configPath, 'utf-8');
      const raw = JSON.parse(content);

      // Substitute env vars
      const withEnv = substituteEnvVarsDeep(raw);

      // Validate and parse
      const validated = ConfigSchema.parse(withEnv);

      this.config = validated;
      console.log(`[ConfigLoader] Loaded config from: ${configPath}`);

      // Start file watcher if enabled
      if (this.watchersEnabled) {
        this.startWatching(configPath);
      }

      return this.config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.warn(`[ConfigLoader] Config file not found: ${configPath}, using defaults`);
        this.config = this.getDefaults();
        return this.config;
      }

      if (error instanceof Error && error.name === 'ZodError') {
        console.error(`[ConfigLoader] Config validation failed:`, error);
        throw new Error(`Invalid config: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * Save config to file
   */
  async save(path?: string): Promise<void> {
    if (!this.config) {
      throw new Error('No config loaded');
    }

    const configPath = path || this.getDefaultPath();

    try {
      // Ensure directory exists
      await mkdir(dirname(configPath), { recursive: true });

      // Write config (redacted for logging)
      const redacted = redactConfig(this.config);
      await writeFile(configPath, JSON.stringify(redacted, null, 2), 'utf-8');
      console.log(`[ConfigLoader] Saved config to: ${configPath}`);
    } catch (error) {
      console.error(`[ConfigLoader] Failed to save config:`, error);
      throw error;
    }
  }

  /**
   * Update config partially
   */
  async update(updates: Partial<Config>, path?: string): Promise<Config> {
    if (!this.config) {
      await this.load(path);
    }

    const merged = { ...this.config, ...updates };
    const validated = ConfigSchema.parse(merged);

    this.config = validated;
    await this.save(path);

    return this.config;
  }

  /**
   * Get current config
   */
  get(): Config;
  /**
   * Get specific config section
   */
  get<K extends keyof Config>(key: K): Config[K];
  /**
   * Get config implementation
   */
  get<K extends keyof Config>(key?: K): Config | Config[K] {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.');
    }
    if (key !== undefined) {
      return this.config[key];
    }
    return this.config;
  }

  /**
   * Check if config is loaded
   */
  isLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Set watchers enabled
   */
  setWatchers(enabled: boolean): void {
    this.watchersEnabled = enabled;
    if (!enabled && this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
  }

  /**
   * Register a change callback
   */
  onchange(handler: (config: Config) => void): void {
    if (!this.watcher) {
      this.watcher = new ConfigWatcher();
    }

    this.watcher.onchange(async (path, eventType) => {
      if (eventType === 'change') {
        try {
          const newConfig = await this.load(path);
          handler(newConfig);
        } catch (error) {
          console.error(`[ConfigLoader] Failed to reload config:`, error);
        }
      }
    });
  }

  /**
   * Create default config
   */
  private getDefaults(): Config {
    return {
      version: '1.0.0',
      agent: {
        id: 'mohs-agent',
        name: 'Mohs Agent',
      },
      providers: {},
      channels: {},
    };
  }

  /**
   * Start watching config file
   */
  private async startWatching(path: string): Promise<void> {
    if (!this.watcher) {
      this.watcher = new ConfigWatcher();
    }

    await this.watcher.watchFile(path);
  }

  /**
   * Close and cleanup
   */
  close(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
  }
}

// Singleton instance
let globalConfigLoader: ConfigLoader | null = null;

export function getConfigLoader(): ConfigLoader {
  if (!globalConfigLoader) {
    globalConfigLoader = new ConfigLoader();
  }
  return globalConfigLoader;
}
