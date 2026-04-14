/**
 * DreamProcessor - Offline Evolution Engine
 *
 * "Dream" (梦境反思) mechanism for offline skill evolution.
 * This is a background process that runs during system idle time
 * (e.g.,深夜 Cron 定时任务).
 *
 * Architecture:
 * 1. Connect to ChromaDB Experience collection
 * 2. Pull successful complex tasks from last 24 hours
 * 3. Call refining prompt to distill patterns (dedupe, logical reasoning)
 * 4. Format as Markdown skill file
 * 5. Store in Semantic collection with vector embedding
 *
 * The framework摒弃了 OpenClaw 原生的浅层记忆，
 * 改为完全依赖基于 ChromaDB 的五层记忆系统。
 */

import { createHash } from 'crypto';
import type {
  ExperienceEntry,
  SemanticEntry,
  Skill,
  SkillFrontmatter,
  MemoryEntry,
} from '../types/index.js';
import { createSkillId } from '../types/index.js';
import { LLMProvider } from '../providers/base/types.js';

/**
 * DreamProcessor configuration
 */
export interface DreamProcessorConfig {
  /** ChromaDB connection path */
  chromaPath: string;
  /** Experience collection name */
  experienceCollection: string;
  /** Semantic collection name */
  semanticCollection: string;
  /** LLM provider for reflection */
  llmProvider: LLMProvider;
  /** Model to use for reflection */
  reflectionModel: string;
  /** Time window for experience retrieval (ms) */
  experienceWindowMs?: number;
  /** Minimum complexity to consider for skill extraction */
  minComplexityScore?: number;
  /** Maximum experiences to process per cycle */
  maxExperiencesPerCycle?: number;
  /** Embedding batch size */
  embeddingBatchSize?: number;
}

/**
 * Extracted pattern from experiences
 */
interface ExtractedPattern {
  title: string;
  description: string;
  rules: string[];
  triggers: string[];
  keywords: string[];
  confidence: number;
  sourceExperiences: string[];
}

/**
 * Skill draft from dream processing
 */
interface DreamSkillDraft {
  frontmatter: SkillFrontmatter;
  content: string;
  pattern: ExtractedPattern;
  generatedAt: number;
}

/**
 * Dream cycle result
 */
export interface DreamCycleResult {
  processedExperiences: number;
  patternsExtracted: number;
  skillsGenerated: number;
  skillsApproved: number;
  errors: string[];
  duration: number;
}

/**
 * ChromaDB client interface (stub - implement with actual ChromaDB)
 */
interface ChromaClient {
  getCollection(name: string): ChromaCollection;
  createCollection(name: string): ChromaCollection;
}

interface ChromaCollection {
  add(params: {
    ids: string[];
    embeddings: number[][];
    documents: string[];
    metadatas: Record<string, unknown>[];
  }): void;
  query(params: {
    query_embeddings: number[][];
    n_results: number;
    where?: Record<string, unknown>;
  }): {
    ids: string[][];
    documents: string[][];
    metadatas: Record<string, unknown>[][];
    distances: number[][];
  };
  get(params?: {
    where?: Record<string, unknown>;
    limit?: number;
  }): {
    ids: string[];
    documents: string[];
    metadatas: Record<string, unknown>[];
  };
}

/**
 * DreamProcessor class
 *
 * Implements the "Dream" (梦境反思) mechanism for offline evolution.
 * Runs in background to extract patterns from successful experiences
 * and generate new skills.
 */
export class DreamProcessor {
  private config: Required<DreamProcessorConfig>;
  private chromaClient?: ChromaClient;
  private experienceCollection?: ChromaCollection;
  private semanticCollection?: ChromaCollection;
  private isRunning: boolean = false;
  private lastCycleTime?: number;

  constructor(config: DreamProcessorConfig) {
    this.config = {
      experienceWindowMs: 24 * 60 * 60 * 1000, // 24 hours
      minComplexityScore: 0.6,
      maxExperiencesPerCycle: 50,
      embeddingBatchSize: 10,
      ...config,
    };
  }

  /**
   * Initialize ChromaDB connections
   */
  async initialize(): Promise<void> {
    // In production, use actual ChromaDB client:
    // const { ChromaClient } = await import('chromadb');
    // this.chromaClient = new ChromaClient({ path: this.config.chromaPath });

    // For now, use stub implementation
    this.chromaClient = this.createStubChromaClient();

    this.experienceCollection = this.chromaClient.getCollection(this.config.experienceCollection);
    this.semanticCollection = this.chromaClient.getCollection(this.config.semanticCollection);

    console.log('[DreamProcessor] Initialized with ChromaDB');
  }

  /**
   * Run a dream cycle
   *
   * This is the main entry point for the offline evolution process.
   * Typically called by a Cron job during system idle time.
   */
  async runDreamCycle(): Promise<DreamCycleResult> {
    if (this.isRunning) {
      console.log('[DreamProcessor] Dream cycle already in progress, skipping');
      return {
        processedExperiences: 0,
        patternsExtracted: 0,
        skillsGenerated: 0,
        skillsApproved: 0,
        errors: ['Cycle already in progress'],
        duration: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const errors: string[] = [];

    console.log('[DreamProcessor] Starting dream cycle...');

    try {
      // Step 1: Connect to ChromaDB Experience collection and pull recent successes
      const experiences = await this.fetchRecentSuccessfulExperiences();

      if (experiences.length === 0) {
        console.log('[DreamProcessor] No recent successful experiences found');
        return this.buildResult(0, 0, 0, 0, errors, startTime);
      }

      console.log(`[DreamProcessor] Fetched ${experiences.length} recent experiences`);

      // Step 2: Group by task type and extract patterns
      const patterns = await this.extractPatterns(experiences);

      if (patterns.length === 0) {
        console.log('[DreamProcessor] No significant patterns extracted');
        return this.buildResult(experiences.length, 0, 0, 0, errors, startTime);
      }

      console.log(`[DreamProcessor] Extracted ${patterns.length} patterns`);

      // Step 3: Generate skill drafts from patterns
      const drafts = await this.generateSkillDrafts(patterns);

      console.log(`[DreamProcessor] Generated ${drafts.length} skill drafts`);

      // Step 4: Judge and store approved skills
      let approvedCount = 0;
      for (const draft of drafts) {
        const approved = await this.judgeAndStoreSkill(draft);
        if (approved) {
          approvedCount++;
        }
      }

      this.lastCycleTime = Date.now();

      console.log(`[DreamProcessor] Dream cycle complete. Approved: ${approvedCount}/${drafts.length}`);

      return this.buildResult(
        experiences.length,
        patterns.length,
        drafts.length,
        approvedCount,
        errors,
        startTime
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(errorMsg);
      console.error(`[DreamProcessor] Dream cycle error: ${errorMsg}`);
      return this.buildResult(0, 0, 0, 0, errors, startTime);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Step 1: Fetch recent successful experiences from ChromaDB
   */
  private async fetchRecentSuccessfulExperiences(): Promise<ExperienceEntry[]> {
    if (!this.experienceCollection) {
      throw new Error('Experience collection not initialized');
    }

    const since = Date.now() - this.config.experienceWindowMs;

    // Query ChromaDB for experiences in time window
    const results = this.experienceCollection.query({
      query_embeddings: [new Array(768).fill(0)], // Dummy embedding for metadata filter
      n_results: this.config.maxExperiencesPerCycle,
      where: {
        timestamp: { $gte: since },
        success: { $eq: true },
      },
    });

    // Parse results into ExperienceEntry format
    const experiences: ExperienceEntry[] = [];

    for (let i = 0; i < results.ids[0].length; i++) {
      const metadata = results.metadatas[0][i];

      if (metadata?.type !== 'experience') continue;

      try {
        const content = JSON.parse(results.documents[0][i]);

        experiences.push({
          id: results.ids[0][i],
          layer: 'experience',
          content: results.documents[0][i],
          timestamp: metadata.timestamp as number,
          agentId: metadata.agentId as string as import('../types/index.js').AgentId,
          type: content.type as 'error' | 'practice' | 'lesson',
          title: content.title || '',
          lesson: content.lesson || '',
          keywords: content.keywords || [],
          success: (metadata.success as boolean) ?? true,
        });
      } catch {
        // Skip invalid entries
      }
    }

    return experiences;
  }

  /**
   * Step 2: Extract patterns from experiences
   *
   * Uses the LLM to identify common approaches, successful strategies,
   * and reusable patterns across multiple experiences.
   */
  private async extractPatterns(experiences: ExperienceEntry[]): Promise<ExtractedPattern[]> {
    if (!this.config.llmProvider) {
      throw new Error('LLM provider not configured');
    }

    // Group experiences by type/keywords for batch processing
    const grouped = this.groupExperiences(experiences);

    const patterns: ExtractedPattern[] = [];

    for (const [groupKey, groupExperiences] of Object.entries(grouped)) {
      if (groupExperiences.length < 2) {
        // Need at least 2 similar experiences to extract a pattern
        continue;
      }

      // Calculate complexity score
      const complexityScore = this.calculateComplexityScore(groupExperiences);

      if (complexityScore < this.config.minComplexityScore) {
        continue;
      }

      // Call LLM to extract pattern
      const pattern = await this.callReflectionPrompt(groupKey, groupExperiences);

      if (pattern && pattern.confidence >= this.config.minComplexityScore) {
        patterns.push(pattern);
      }
    }

    // Deduplicate patterns
    return this.deduplicatePatterns(patterns);
  }

  /**
   * Group experiences by similar keywords or task type
   */
  private groupExperiences(
    experiences: ExperienceEntry[]
  ): Record<string, ExperienceEntry[]> {
    const groups: Record<string, ExperienceEntry[]> = {};

    for (const exp of experiences) {
      // Use first keyword as group key, or "general" if no keywords
      const key = exp.keywords[0] || 'general';

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(exp);
    }

    return groups;
  }

  /**
   * Calculate complexity score for a group of experiences
   *
   * Higher score = more complex = better candidate for skill extraction
   */
  private calculateComplexityScore(experiences: ExperienceEntry[]): number {
    if (experiences.length === 0) return 0;

    // Factors:
    // 1. Number of experiences (more = higher confidence in pattern)
    // 2. Lesson text length (longer = more detail = higher quality)
    // 3. Keyword diversity

    const countFactor = Math.min(experiences.length / 10, 1) * 0.3;
    const avgLessonLength =
      experiences.reduce((sum, e) => sum + e.lesson.length, 0) / experiences.length;
    const lengthFactor = Math.min(avgLessonLength / 500, 1) * 0.4;

    const allKeywords = experiences.flatMap((e) => e.keywords);
    const uniqueKeywords = new Set(allKeywords);
    const keywordFactor = Math.min(uniqueKeywords.size / 5, 1) * 0.3;

    return countFactor + lengthFactor + keywordFactor;
  }

  /**
   * Call the reflection prompt to extract a pattern
   */
  private async callReflectionPrompt(
    groupKey: string,
    experiences: ExperienceEntry[]
  ): Promise<ExtractedPattern | null> {
    const experiencesText = experiences
      .map(
        (e, i) =>
          `[Experience ${i + 1}]\nTitle: ${e.title}\nLesson: ${e.lesson}\nKeywords: ${e.keywords.join(', ')}`
      )
      .join('\n\n');

    const prompt = `## Reflection Prompt: Pattern Extraction

You are analyzing a set of successful task completions to identify reusable patterns.

### Experiences to Analyze
${experiencesText}

### Task
Analyze these experiences and identify:
1. A common APPROACH or STRATEGY that led to success
2. Key RULES or GUIDELINES that were followed
3. TRIGGERS - when should this approach be used?
4. Keywords for categorization

### Output Format
Return a JSON object:
{
  "title": "Brief descriptive title (3-5 words)",
  "description": "When to use this pattern (1-2 sentences)",
  "rules": ["Rule 1", "Rule 2", "Rule 3"],
  "triggers": ["trigger keyword 1", "trigger keyword 2"],
  "keywords": ["relevant", "keywords"],
  "confidence": 0.0-1.0 (how confident are you this is a real pattern)
}

Only output the JSON object, no additional text.`;

    try {
      const response = await this.config.llmProvider.chat({
        model: this.config.reflectionModel,
        messages: [
          {
            id: 'system',
            role: 'system',
            content: 'You are a pattern analysis expert. Analyze experiences and extract reusable patterns.',
            timestamp: Date.now(),
          },
          {
            id: 'user',
            role: 'user',
            content: prompt,
            timestamp: Date.now(),
          },
        ],
        temperature: 0.3,
        maxTokens: 1000,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) return null;

      // Parse JSON response
      const parsed = JSON.parse(content);

      return {
        title: parsed.title || groupKey,
        description: parsed.description || '',
        rules: parsed.rules || [],
        triggers: parsed.triggers || [],
        keywords: parsed.keywords || [groupKey],
        confidence: parsed.confidence || 0.5,
        sourceExperiences: experiences.map((e) => e.id),
      };
    } catch (error) {
      console.error(`[DreamProcessor] Pattern extraction failed for ${groupKey}:`, error);
      return null;
    }
  }

  /**
   * Deduplicate patterns by title + content hash
   */
  private deduplicatePatterns(patterns: ExtractedPattern[]): ExtractedPattern[] {
    const seen = new Set<string>();

    return patterns.filter((p) => {
      const hash = createHash('sha256')
        .update(`${p.title}:${p.description}`)
        .digest('hex')
        .substring(0, 16);

      if (seen.has(hash)) {
        return false;
      }
      seen.add(hash);
      return true;
    });
  }

  /**
   * Step 3: Generate skill drafts from patterns
   */
  private async generateSkillDrafts(patterns: ExtractedPattern[]): Promise<DreamSkillDraft[]> {
    const drafts: DreamSkillDraft[] = [];

    for (const pattern of patterns) {
      const draft = this.formatSkillDraft(pattern);
      drafts.push(draft);
    }

    return drafts;
  }

  /**
   * Format a pattern into a Markdown skill document
   */
  private formatSkillDraft(pattern: ExtractedPattern): DreamSkillDraft {
    const skillId = createSkillId(pattern.title.toLowerCase().replace(/\s+/g, '-'));

    const frontmatter: SkillFrontmatter = {
      name: pattern.title.toLowerCase().replace(/\s+/g, '-'),
      description: `Use when ${pattern.description}`,
      version: '1.0.0',
      platforms: ['any'],
      metadata: {
        hermes: {
          tags: pattern.keywords,
        },
      },
      whenToUse: pattern.triggers.join(', '),
      rules: pattern.rules,
    };

    const content = `# ${pattern.title}

## Overview
${pattern.description}

## When to Use
This skill applies when:
${pattern.triggers.map((t) => `- ${t}`).join('\n')}

## Rules
${pattern.rules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Confidence
Auto-generated from ${pattern.sourceExperiences.length} successful experiences.
Confidence score: ${(pattern.confidence * 100).toFixed(0)}%

## Keywords
${pattern.keywords.join(', ')}
`;

    return {
      frontmatter,
      content,
      pattern,
      generatedAt: Date.now(),
    };
  }

  /**
   * Step 4: Judge skill draft and store if approved
   *
   * In production, this would use LLM to validate:
   * - Is the trigger condition clear?
   * - Is the content actionable?
   * - Does it follow skill conventions?
   */
  private async judgeAndStoreSkill(draft: DreamSkillDraft): Promise<boolean> {
    // Basic validation
    if (!draft.frontmatter.name || draft.frontmatter.name.length < 3) {
      return false;
    }

    if (!draft.frontmatter.description || draft.frontmatter.description.length < 10) {
      return false;
    }

    if (!draft.content || draft.content.length < 50) {
      return false;
    }

    // Confidence threshold
    if (draft.pattern.confidence < this.config.minComplexityScore) {
      return false;
    }

    // Store in semantic collection with embedding
    await this.storeSkillInSemantic(draft);

    console.log(`[DreamProcessor] Stored new skill: ${draft.frontmatter.name}`);

    return true;
  }

  /**
   * Store skill in semantic collection with vector embedding
   */
  private async storeSkillInSemantic(draft: DreamSkillDraft): Promise<void> {
    if (!this.semanticCollection) {
      throw new Error('Semantic collection not initialized');
    }

    // Generate embedding for the skill content
    const embedding = await this.generateEmbedding(
      `${draft.frontmatter.name} ${draft.frontmatter.description} ${draft.content}`
    );

    const skillId = `dream-skill-${draft.frontmatter.name}-${Date.now()}`;

    this.semanticCollection.add({
      ids: [skillId],
      embeddings: [embedding],
      documents: [`${draft.frontmatter.name}\n\n${draft.content}`],
      metadatas: [
        {
          type: 'dream_generated_skill',
          layer: 'semantic',
          name: draft.frontmatter.name,
          description: draft.frontmatter.description,
          keywords: draft.pattern.keywords,
          confidence: draft.pattern.confidence,
          generatedAt: draft.generatedAt,
          sourceExperiences: draft.pattern.sourceExperiences,
        },
      ],
    });
  }

  /**
   * Generate embedding for text using LLM provider
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Use LLM provider's embeddings method
    // This is provider-specific
    try {
      const response = await this.config.llmProvider.embeddings({
        model: 'embo-01', // Use appropriate embedding model
        input: text,
      });

      return response.data[0]?.embedding || new Array(768).fill(0);
    } catch {
      // Fallback to dummy embedding
      return new Array(768).fill(0);
    }
  }

  /**
   * Build result object
   */
  private buildResult(
    processed: number,
    patterns: number,
    drafts: number,
    approved: number,
    errors: string[],
    startTime: number
  ): DreamCycleResult {
    return {
      processedExperiences: processed,
      patternsExtracted: patterns,
      skillsGenerated: drafts,
      skillsApproved: approved,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check if dream processor is currently running
   */
  isDreaming(): boolean {
    return this.isRunning;
  }

  /**
   * Get last cycle time
   */
  getLastCycleTime(): number | undefined {
    return this.lastCycleTime;
  }

  /**
   * Create stub ChromaDB client for development
   */
  private createStubChromaClient(): ChromaClient {
    // In-memory storage for development
    const storage: Map<string, Array<{
      id: string;
      document: string;
      metadata: Record<string, unknown>;
      embedding?: number[];
    }>> = new Map();

    return {
      getCollection(name: string): ChromaCollection {
        if (!storage.has(name)) {
          storage.set(name, []);
        }

        return {
          add(params: { ids: string[]; embeddings: number[][]; documents: string[]; metadatas: Record<string, unknown>[] }) {
            const items = storage.get(name) || [];
            for (let i = 0; i < params.ids.length; i++) {
              items.push({
                id: params.ids[i],
                document: params.documents[i],
                metadata: params.metadatas[i],
                embedding: params.embeddings?.[i],
              });
            }
            storage.set(name, items);
          },

          query(params: { query_embeddings: number[][]; n_results: number; where?: Record<string, unknown> }) {
            const items = storage.get(name) || [];
            // Simple mock - return all items within limit
            return {
              ids: [items.slice(0, params.n_results).map(i => i.id)],
              documents: [items.slice(0, params.n_results).map(i => i.document)],
              metadatas: [items.slice(0, params.n_results).map(i => i.metadata)],
              distances: [items.slice(0, params.n_results).map(() => 0)],
            };
          },

          get(params?: { where?: Record<string, unknown>; limit?: number }) {
            const items = storage.get(name) || [];
            return {
              ids: items.map(i => i.id),
              documents: items.map(i => i.document),
              metadatas: items.map(i => i.metadata),
            };
          },
        };
      },

      createCollection(name: string): ChromaCollection {
        storage.set(name, []);
        return this.getCollection(name);
      },
    };
  }
}
