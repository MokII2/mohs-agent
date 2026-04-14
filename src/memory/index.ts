/**
 * Five-Layer Memory Architecture
 *
 * Inspired by memory-context's biologically-inspired memory model:
 *
 * Layer 1: Sensory     - Raw conversation input (183 day retention)
 * Layer 2: Working     - Current task context (20 messages, 7 days)
 * Layer 3: Semantic    - Compressed knowledge via ChromaDB (persistent)
 * Layer 4: Episodic    - Monthly conversation archives (12 months)
 * Layer 5: Experience  - Trial/error outcomes (500 entries, 90 days)
 *
 * This architecture is the "底层支撑" (underlying support) for Hermes'
 * self-evolution mechanism.
 */

import { createHash } from 'crypto';
import type {
  AgentId,
  SessionId,
  MessageRole,
  MemoryEntry,
  MemoryQuery,
  MemoryLayerType,
  IMemoryLayer,
  IMemoryClient,
  SensoryEntry,
  WorkingEntry,
  SemanticEntry,
  EpisodicEntry,
  ExperienceEntry,
  MemoryConfig,
} from '../types/index.js';

// ============================================================================
// Layer Implementations
// ============================================================================

/**
 * Sensory Memory Layer - Tier 1
 *
 * Stores raw conversation messages as they come in.
 * Retention: 183 days (configurable)
 *
 * Key features:
 * - Deduplication by content hash
 * - Role filtering (user/assistant only)
 * - Automatic cleanup of old entries
 */
export class SensoryMemoryLayer implements IMemoryLayer {
  readonly type: MemoryLayerType = 'sensory';
  readonly agentId: AgentId;
  private entries: Map<string, SensoryEntry> = new Map();
  private readonly retentionDays: number;

  constructor(agentId: AgentId, retentionDays: number = 183) {
    this.agentId = agentId;
    this.retentionDays = retentionDays;
  }

  async initialize(): Promise<void> {
    console.log(`[SensoryMemory] Initialized for agent ${this.agentId}`);
  }

  async store(entries: MemoryEntry[]): Promise<void> {
    const now = Date.now();

    for (const entry of entries) {
      // Only accept sensory entries
      const sensoryEntry: SensoryEntry = {
        id: entry.id,
        layer: 'sensory' as const,
        content: entry.content,
        timestamp: entry.timestamp || now,
        agentId: this.agentId,
        sessionId: entry.sessionId ?? ('session-' + entry.id as SessionId),
        role: (entry.metadata?.role as MessageRole) ?? 'user',
        contentHash: this.hashContent(entry.content),
      };

      // Deduplication key
      const key = this.getDeduplicationKey(sensoryEntry);
      if (!this.entries.has(key)) {
        this.entries.set(key, sensoryEntry);
      }
    }

    // Cleanup old entries
    await this.cleanup();
  }

  async retrieve(query: MemoryQuery): Promise<MemoryEntry[]> {
    const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    return Array.from(this.entries.values())
      .filter((entry) => {
        if (entry.timestamp < cutoff) return false;
        if (query.sessionId && entry.sessionId !== query.sessionId) return false;
        if (query.agentId && entry.agentId !== query.agentId) return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, query.topK ?? 50);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private getDeduplicationKey(entry: SensoryEntry): string {
    return `${entry.role}:${entry.contentHash}`;
  }

  private async cleanup(): Promise<void> {
    const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    for (const [key, entry] of this.entries) {
      if (entry.timestamp < cutoff) {
        this.entries.delete(key);
      }
    }
  }
}

/**
 * Working Memory Layer - Tier 2
 *
 * Stores current task context - the "scratchpad" for active work.
 * Retention: 20 most recent messages, 7 days
 *
 * Key features:
 * - Bounded storage (max 20 entries)
 * - Task-scoped context
 * - Active/inactive status tracking
 */
export class WorkingMemoryLayer implements IMemoryLayer {
  readonly type: MemoryLayerType = 'working';
  readonly agentId: AgentId;
  private entries: WorkingEntry[] = [];
  private readonly maxEntries: number;
  private readonly retentionDays: number;

  constructor(agentId: AgentId, maxEntries: number = 20, retentionDays: number = 7) {
    this.agentId = agentId;
    this.maxEntries = maxEntries;
    this.retentionDays = retentionDays;
  }

  async initialize(): Promise<void> {
    console.log(`[WorkingMemory] Initialized for agent ${this.agentId}`);
  }

  async store(entries: MemoryEntry[]): Promise<void> {
    const now = Date.now();

    for (const entry of entries) {
      const workingEntry: WorkingEntry = {
        ...entry,
        layer: 'working',
        agentId: this.agentId,
        isActive: true,
        timestamp: entry.timestamp || now,
      };

      // Add to front (most recent first)
      this.entries.unshift(workingEntry);

      // Enforce max entries
      if (this.entries.length > this.maxEntries) {
        this.entries = this.entries.slice(0, this.maxEntries);
      }
    }

    // Cleanup old entries
    await this.cleanup();
  }

  async retrieve(query: MemoryQuery): Promise<MemoryEntry[]> {
    const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    return this.entries
      .filter((entry) => {
        if (entry.timestamp < cutoff) return false;
        if (query.agentId && entry.agentId !== query.agentId) return false;
        if (query.sessionId && entry.sessionId !== query.sessionId) return false;
        if (query.tags?.length) {
          const hasTag = entry.tags?.some((t) => query.tags!.includes(t));
          if (!hasTag) return false;
        }
        return true;
      })
      .slice(0, query.topK ?? this.maxEntries);
  }

  async clear(): Promise<void> {
    this.entries = [];
  }

  /**
   * Mark entries as inactive (after task completion)
   */
  async deactivateTask(taskId: string): Promise<void> {
    for (const entry of this.entries) {
      if (entry.metadata?.taskId === taskId) {
        entry.isActive = false;
      }
    }
  }

  private async cleanup(): Promise<void> {
    const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    this.entries = this.entries.filter(
      (entry) => entry.timestamp >= cutoff
    );
  }
}

/**
 * Semantic Memory Layer - Tier 3
 *
 * Stores compressed knowledge using vector embeddings (ChromaDB).
 * Retention: Persistent (with periodic compression)
 *
 * Key features:
 * - ChromaDB vector storage
 * - Semantic similarity search
 * - Agent namespace isolation
 *
 * Note: This is a stub implementation. In production, integrate with
 * actual ChromaDB client (chromadb package).
 */
export class SemanticMemoryLayer implements IMemoryLayer {
  readonly type: MemoryLayerType = 'semantic';
  readonly agentId: AgentId;
  private entries: Map<string, SemanticEntry> = new Map();
  private readonly collectionName: string;
  private readonly chromaPath?: string;

  constructor(agentId: AgentId, chromaPath?: string) {
    this.agentId = agentId;
    this.chromaPath = chromaPath;
    this.collectionName = `semantic_${agentId}`;
  }

  async initialize(): Promise<void> {
    console.log(`[SemanticMemory] Initialized for agent ${this.agentId}`);

    // In production, initialize ChromaDB client here:
    // this.chromaClient = new ChromaClient({ path: this.chromaPath });
    // await this.chromaClient.createCollection(this.collectionName);

    console.log(`[SemanticMemory] ChromaDB path: ${this.chromaPath ?? 'memory only'}`);
  }

  async store(entries: MemoryEntry[]): Promise<void> {
    const now = Date.now();

    for (const entry of entries) {
      const semanticEntry: SemanticEntry = {
        ...entry,
        layer: 'semantic',
        agentId: this.agentId,
        collectionName: this.collectionName,
        sourceType: entry.metadata?.sourceType as SemanticEntry['sourceType'] ?? 'sensory_compression',
        timestamp: entry.timestamp || now,
      };

      // In production, generate embedding and store in ChromaDB
      // const embedding = await this.generateEmbedding(entry.content);
      // await this.chromaClient.add({
      //   ids: [entry.id],
      //   embeddings: [embedding],
      //   documents: [entry.content],
      //   metadatas: [semanticEntry],
      // });

      this.entries.set(entry.id, semanticEntry);
    }
  }

  async retrieve(query: MemoryQuery): Promise<MemoryEntry[]> {
    if (!query.query) {
      // Return recent entries if no query
      return Array.from(this.entries.values())
        .filter((e) => e.agentId === this.agentId)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, query.topK ?? 10);
    }

    // In production, perform vector search:
    // const results = await this.chromaClient.query({
    //   query_embeddings: [await this.generateEmbedding(query.query)],
    //   n_results: query.topK ?? 10,
    //   where: { agentId: this.agentId },
    // });

    // For now, simple text search
    const queryLower = query.query.toLowerCase();
    return Array.from(this.entries.values())
      .filter((entry) => {
        if (entry.agentId !== this.agentId) return false;
        return entry.content.toLowerCase().includes(queryLower);
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, query.topK ?? 10);
  }

  async clear(): Promise<void> {
    this.entries.clear();
    // In production: await this.chromaClient.delete({ where: {} });
  }

  /**
   * Search by semantic similarity
   */
  async semanticSearch(query: string, topK: number = 5): Promise<SemanticEntry[]> {
    const results = await this.retrieve({ query, topK, agentId: this.agentId });
    return results as SemanticEntry[];
  }
}

/**
 * Episodic Memory Layer - Tier 4
 *
 * Stores monthly conversation archives.
 * Retention: 12 months (360 days)
 *
 * Key features:
 * - Monthly grouping (YYYY-MM keys)
 * - Structured archive format
 * - Efficient retrieval by time range
 */
export class EpisodicMemoryLayer implements IMemoryLayer {
  readonly type: MemoryLayerType = 'episodic';
  readonly agentId: AgentId;
  private entries: Map<string, EpisodicEntry> = new Map();
  private readonly retentionMonths: number;

  constructor(agentId: AgentId, retentionMonths: number = 12) {
    this.agentId = agentId;
    this.retentionMonths = retentionMonths;
  }

  async initialize(): Promise<void> {
    console.log(`[EpisodicMemory] Initialized for agent ${this.agentId}`);
  }

  async store(entries: MemoryEntry[]): Promise<void> {
    const now = Date.now();

    for (const entry of entries) {
      const monthKey = this.getMonthKey(entry.timestamp || now);
      const messageCount = typeof entry.metadata?.messageCount === 'number'
        ? entry.metadata.messageCount
        : 1;

      const episodicEntry: EpisodicEntry = {
        ...entry,
        layer: 'episodic',
        agentId: this.agentId,
        monthKey,
        messageCount,
        timestamp: entry.timestamp || now,
      };

      this.entries.set(`${monthKey}_${entry.id}`, episodicEntry);
    }

    // Cleanup old months
    await this.cleanup();
  }

  async retrieve(query: MemoryQuery): Promise<MemoryEntry[]> {
    const results: EpisodicEntry[] = [];

    for (const entry of this.entries.values()) {
      if (entry.agentId !== this.agentId) continue;

      // Filter by month if specified
      if (query.since || query.until) {
        const entryTime = entry.timestamp;
        if (query.since && entryTime < query.since) continue;
        if (query.until && entryTime > query.until) continue;
      }

      if (query.sessionId && entry.sessionId !== query.sessionId) continue;

      results.push(entry);
    }

    return results
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, query.topK ?? 50);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  /**
   * Get entries for a specific month
   */
  async getMonth(monthKey: string): Promise<EpisodicEntry[]> {
    return Array.from(this.entries.values()).filter(
      (e) => e.monthKey === monthKey && e.agentId === this.agentId
    );
  }

  private getMonthKey(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private async cleanup(): Promise<void> {
    const maxAge = this.retentionMonths * 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    for (const [key, entry] of this.entries) {
      if (entry.timestamp < cutoff) {
        this.entries.delete(key);
      }
    }
  }
}

/**
 * Experience Memory Layer - Tier 5
 *
 * Stores trial/error outcomes and lessons learned.
 * Retention: 500 entries max, 90 days
 *
 * Key features:
 * - Success/failure classification
 * - Keyword-based retrieval
 * - Heavy dependency from Hermes evolution
 */
export class ExperienceMemoryLayer implements IMemoryLayer {
  readonly type: MemoryLayerType = 'experience';
  readonly agentId: AgentId;
  private entries: Map<string, ExperienceEntry> = new Map();
  private readonly maxEntries: number;
  private readonly retentionDays: number;

  constructor(agentId: AgentId, maxEntries: number = 500, retentionDays: number = 90) {
    this.agentId = agentId;
    this.maxEntries = maxEntries;
    this.retentionDays = retentionDays;
  }

  async initialize(): Promise<void> {
    console.log(`[ExperienceMemory] Initialized for agent ${this.agentId}`);
  }

  async store(entries: MemoryEntry[]): Promise<void> {
    const now = Date.now();

    for (const entry of entries) {
      let parsed: Partial<ExperienceEntry> = {};

      try {
        parsed = JSON.parse(entry.content);
      } catch {
        // Non-JSON content treated as lesson
      }

      const experienceEntry: ExperienceEntry = {
        ...entry,
        layer: 'experience',
        agentId: this.agentId,
        type: (parsed.type as ExperienceEntry['type']) ?? 'lesson',
        title: parsed.title ?? entry.content.substring(0, 50),
        lesson: parsed.lesson ?? entry.content,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : (entry.tags ?? []),
        success: typeof parsed.success === 'boolean' ? parsed.success : true,
        timestamp: entry.timestamp || now,
      };

      // Deduplication by title + lesson hash
      const key = this.getDeduplicationKey(experienceEntry);
      if (!this.entries.has(key)) {
        this.entries.set(key, experienceEntry);
      }
    }

    // Enforce max entries (FIFO)
    while (this.entries.size > this.maxEntries) {
      const oldest = Array.from(this.entries.values())
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      if (oldest) {
        this.entries.delete(this.getDeduplicationKey(oldest));
      }
    }

    // Cleanup old entries
    await this.cleanup();
  }

  async retrieve(query: MemoryQuery): Promise<MemoryEntry[]> {
    const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    return Array.from(this.entries.values())
      .filter((entry) => {
        if (entry.timestamp < cutoff) return false;
        if (entry.agentId !== this.agentId) return false;

        // Filter by keywords
        if (query.tags?.length) {
          const hasKeyword = entry.keywords.some((k) =>
            query.tags!.some((t) => k.toLowerCase().includes(t.toLowerCase()))
          );
          if (!hasKeyword) return false;
        }

        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, query.topK ?? 20);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  /**
   * Search experiences by keyword
   */
  async searchByKeyword(keyword: string): Promise<ExperienceEntry[]> {
    const keywordLower = keyword.toLowerCase();

    return Array.from(this.entries.values())
      .filter((entry) => {
        return (
          entry.keywords.some((k) => k.toLowerCase().includes(keywordLower)) ||
          entry.title.toLowerCase().includes(keywordLower) ||
          entry.lesson.toLowerCase().includes(keywordLower)
        );
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get only errors
   */
  async getErrors(): Promise<ExperienceEntry[]> {
    return Array.from(this.entries.values())
      .filter((e) => e.type === 'error' && e.agentId === this.agentId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get only good practices
   */
  async getPractices(): Promise<ExperienceEntry[]> {
    return Array.from(this.entries.values())
      .filter((e) => e.type === 'practice' && e.agentId === this.agentId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  private getDeduplicationKey(entry: ExperienceEntry): string {
    const hash = createHash('sha256')
      .update(`${entry.title}:${entry.lesson}`)
      .digest('hex')
      .substring(0, 16);
    return hash;
  }

  private async cleanup(): Promise<void> {
    const maxAge = this.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;

    for (const [key, entry] of this.entries) {
      if (entry.timestamp < cutoff) {
        this.entries.delete(key);
      }
    }
  }
}

// ============================================================================
// Memory Client - Unified Interface
// ============================================================================

/**
 * Memory client providing unified access to all five layers
 */
export class MemoryClient implements IMemoryClient {
  readonly sensory!: IMemoryLayer;
  readonly working!: IMemoryLayer;
  readonly semantic!: IMemoryLayer;
  readonly episodic!: IMemoryLayer;
  readonly experience!: IMemoryLayer;

  private agentId!: AgentId;
  private initialized: boolean = false;

  constructor(agentId: AgentId, config?: MemoryConfig) {
    this.agentId = agentId;

    const policy = config?.retentionPolicy;

    this.sensory = new SensoryMemoryLayer(
      agentId,
      policy?.sensoryDays ?? 183
    );

    this.working = new WorkingMemoryLayer(
      agentId,
      policy?.workingMaxEntries ?? 20,
      7
    );

    this.semantic = new SemanticMemoryLayer(
      agentId,
      config?.chromaPath
    );

    this.episodic = new EpisodicMemoryLayer(
      agentId,
      policy?.episodicMonths ?? 12
    );

    this.experience = new ExperienceMemoryLayer(
      agentId,
      policy?.experienceMaxEntries ?? 500,
      policy?.experienceDays ?? 90
    );
  }

  async initialize(agentId: AgentId): Promise<void> {
    this.agentId = agentId;

    await Promise.all([
      this.sensory.initialize(),
      this.working.initialize(),
      this.semantic.initialize(),
      this.episodic.initialize(),
      this.experience.initialize(),
    ]);

    this.initialized = true;
    console.log(`[MemoryClient] All layers initialized for agent ${agentId}`);
  }

  async store(layer: MemoryLayerType, entries: MemoryEntry[]): Promise<void> {
    if (!this.initialized) {
      throw new Error('MemoryClient not initialized');
    }

    const layerImpl = this.getLayer(layer);
    await layerImpl.store(entries);
  }

  async retrieve(query: MemoryQuery): Promise<MemoryEntry[]> {
    if (!this.initialized) {
      throw new Error('MemoryClient not initialized');
    }

    if (query.layer) {
      const layerImpl = this.getLayer(query.layer);
      return layerImpl.retrieve(query);
    }

    // Query all layers
    const results = await Promise.all([
      this.sensory.retrieve(query),
      this.working.retrieve(query),
      this.semantic.retrieve(query),
      this.episodic.retrieve(query),
      this.experience.retrieve(query),
    ]);

    // Merge and dedupe
    const seen = new Set<string>();
    const merged: MemoryEntry[] = [];

    for (const layerResults of results) {
      for (const entry of layerResults) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id);
          merged.push(entry);
        }
      }
    }

    return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, query.limit ?? 50);
  }

  async search(
    query: string,
    options: { topK?: number; layers?: MemoryLayerType[] } = {}
  ): Promise<MemoryEntry[]> {
    if (!this.initialized) {
      throw new Error('MemoryClient not initialized');
    }

    const layers = options.layers ?? ['sensory', 'working', 'semantic', 'episodic', 'experience'];
    const topK = options.topK ?? 10;

    const results = await Promise.all(
      layers.map((layer) => this.getLayer(layer).retrieve({ query, topK, agentId: this.agentId }))
    );

    // Merge results
    const merged: MemoryEntry[] = [];
    const seen = new Set<string>();

    for (const layerResults of results) {
      for (const entry of layerResults) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id);
          merged.push(entry);
        }
      }
    }

    return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, topK);
  }

  async clear(layer?: MemoryLayerType): Promise<void> {
    if (layer) {
      const memLayer = this.getLayer(layer) as IMemoryLayer;
      await memLayer.clear();
    } else {
      await Promise.all([
        (this.sensory as IMemoryLayer).clear(),
        (this.working as IMemoryLayer).clear(),
        (this.semantic as IMemoryLayer).clear(),
        (this.episodic as IMemoryLayer).clear(),
        (this.experience as IMemoryLayer).clear(),
      ]);
    }
  }

  private getLayer(layer: MemoryLayerType): IMemoryLayer {
    switch (layer) {
      case 'sensory':
        return this.sensory!;
      case 'working':
        return this.working!;
      case 'semantic':
        return this.semantic!;
      case 'episodic':
        return this.episodic!;
      case 'experience':
        return this.experience!;
      default:
        throw new Error(`Unknown memory layer: ${layer}`);
    }
  }
}

// ============================================================================
// Memory Factory
// ============================================================================

/**
 * Create a memory client for an agent
 */
export function createMemoryClient(agentId: AgentId, config?: MemoryConfig): IMemoryClient {
  return new MemoryClient(agentId, config);
}
