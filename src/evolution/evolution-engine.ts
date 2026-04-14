/**
 * Evolution Engine - Self-Evolution and Reflection System
 *
 * Inspired by Hermes' self-evolution mechanism, this engine implements:
 * 1. Background reflection on task execution
 * 2. Experience tracking (trial and error)
 * 3. Auto-generation of new skills from successful executions
 * 4. Skill draft validation and improvement
 * 5. DreamProcessor for offline evolution during idle time
 *
 * The "soul" of the agent - learning from experience.
 *
 * Architecture note:
 * The framework摒弃了 OpenClaw 原生的浅层记忆，改为完全依赖基于 ChromaDB 的五层记忆系统。
 * DreamProcessor handles the "Dream" (梦境反思) mechanism for offline evolution.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Task,
  TaskResult,
  TaskError,
  ExecutionContext,
  Reflection,
  ExperienceRecord,
  SkillDraft,
  SkillJudgment,
  MemoryEntry,
  Skill,
  TaskId,
  SessionId,
} from '../types/index.js';
import { createSkillId } from '../types/index.js';

// Re-export DreamProcessor
export { DreamProcessor } from './dream-processor.js';
export type { DreamProcessorConfig } from './dream-processor.js';
export type { DreamCycleResult } from './dream-processor.js';

/**
 * Evolution engine configuration
 */
export interface EvolutionConfig {
  enableReflection: boolean;
  enableAutoSkillGen: boolean;
  enableDreamProcessing?: boolean; // Enable offline dream cycles
  skillGenThreshold?: number; // Min confidence to auto-generate skill
  reflectionIntervalMs?: number;
  maxExperienceRecords?: number;
  dreamProcessorConfig?: {
    chromaPath: string;
    experienceCollection?: string;
    semanticCollection?: string;
    reflectionModel?: string;
  };
}

/**
 * Reflection review prompt templates
 */
const REFLECTION_PROMPTS = {
  skill: `Review the conversation above and consider saving or updating a skill if appropriate.
Focus on: non-trivial approaches used, trial and error, changing course, successful patterns.`,

  memory: `Review the conversation above and consider saving to memory if appropriate.
Focus on: user persona, preferences, expectations, important context.`,

  improvement: `Analyze this task execution and identify potential improvements.
Consider: what worked well, what didn't, what could be done differently.`,
};

/**
 * Skill generation prompt template
 */
const SKILL_GEN_PROMPT = `Based on the following successful task execution, generate a skill document.

Task: {taskDescription}
What worked: {successfulApproach}
Key insights: {insights}

Generate a SKILL.md with:
1. name: descriptive hyphenated name
2. description: "Use when..." trigger condition
3. content: brief skill content with rules/guidelines

Return the skill as JSON with frontmatter and content fields.`;

/**
 * Default evolution engine implementation
 */
export class EvolutionEngine {
  private readonly config: EvolutionConfig;
  private readonly experienceRecords: ExperienceRecord[] = [];
  private readonly pendingSkillDrafts: SkillDraft[] = [];
  private reflectionHistory: Reflection[] = [];

  // Callbacks for external integration
  private onSkillGenerated?: (skill: Skill) => void;
  private onExperienceStored?: (entry: MemoryEntry) => void;

  constructor(config: EvolutionConfig) {
    this.config = {
      enableReflection: config.enableReflection ?? true,
      enableAutoSkillGen: config.enableAutoSkillGen ?? true,
      enableDreamProcessing: config.enableDreamProcessing ?? false,
      skillGenThreshold: config.skillGenThreshold ?? 0.7,
      reflectionIntervalMs: config.reflectionIntervalMs ?? 5000,
      maxExperienceRecords: config.maxExperienceRecords ?? 500,
      dreamProcessorConfig: config.dreamProcessorConfig,
    };
  }

  // =========================================================================
  // Reflection Processing
  // =========================================================================

  /**
   * Process a reflection from task execution
   *
   * Called after task completion to generate insights.
   */
  async processReflection(
    reflection: Reflection,
    context: ExecutionContext
  ): Promise<void> {
    if (!this.config.enableReflection) return;

    this.reflectionHistory.push(reflection);

    // If skill suggestion, potentially generate a skill
    if (
      reflection.type === 'skill_suggestion' &&
      this.config.enableAutoSkillGen &&
      reflection.confidence >= this.config.skillGenThreshold
    ) {
      await this.generateSkillFromReflection(reflection, context);
    }

    console.log(
      `[Evolution] Processed reflection: ${reflection.type} (confidence: ${reflection.confidence.toFixed(2)})`
    );
  }

  /**
   * Record a failed task for improvement tracking
   */
  async recordFailure(
    task: Task,
    error: TaskError,
    context: ExecutionContext
  ): Promise<void> {
    const record: ExperienceRecord = {
      id: uuidv4(),
      taskId: task.id,
      type: 'failure',
      approach: task.description,
      outcome: error.message,
      lessons: this.extractLessonsFromError(task, error),
      keywords: this.extractKeywords(task),
      timestamp: Date.now(),
      success: false,
    };

    this.addExperienceRecord(record);

    // Store in memory if available
    if (context.memory) {
      const entry: MemoryEntry = {
        id: uuidv4(),
        layer: 'experience',
        content: JSON.stringify({
          type: 'error',
          title: task.type,
          description: error.message,
          lesson: record.lessons.join('; '),
          keywords: record.keywords,
        }),
        timestamp: Date.now(),
        agentId: context.sessionId as unknown as import('../types/index.js').AgentId,
        sessionId: context.sessionId,
        metadata: { taskId: task.id, success: false },
        tags: record.keywords,
      };
      await context.memory.store('experience', [entry]);
      this.onExperienceStored?.(entry);
    }

    console.log(
      `[Evolution] Recorded failure: ${task.type} - ${error.message.substring(0, 50)}...`
    );
  }

  /**
   * Record a successful task
   */
  async recordSuccess(
    task: Task,
    result: TaskResult,
    context: ExecutionContext
  ): Promise<void> {
    const record: ExperienceRecord = {
      id: uuidv4(),
      taskId: task.id,
      type: 'success',
      approach: task.description,
      outcome: result.output?.content ?? 'Completed',
      lessons: this.extractLessonsFromSuccess(task, result),
      keywords: this.extractKeywords(task),
      timestamp: Date.now(),
      success: true,
    };

    this.addExperienceRecord(record);

    // Store in memory
    if (context.memory) {
      const entry: MemoryEntry = {
        id: uuidv4(),
        layer: 'experience',
        content: JSON.stringify({
          type: 'practice',
          title: task.type,
          description: task.description,
          lesson: record.lessons.join('; '),
          keywords: record.keywords,
        }),
        timestamp: Date.now(),
        agentId: context.sessionId as unknown as import('../types/index.js').AgentId,
        sessionId: context.sessionId,
        metadata: { taskId: task.id, success: true },
        tags: record.keywords,
      };
      await context.memory.store('experience', [entry]);
      this.onExperienceStored?.(entry);
    }

    console.log(`[Evolution] Recorded success: ${task.type}`);
  }

  // =========================================================================
  // Skill Generation
  // =========================================================================

  /**
   * Generate a skill from reflection
   *
   * This is the core "learning" mechanism - converting successful
   * task executions into reusable skills.
   */
  private async generateSkillFromReflection(
    reflection: Reflection,
    context: ExecutionContext
  ): Promise<Skill | null> {
    try {
      // Generate skill draft
      const draft = await this.createSkillDraft(reflection, context);

      if (!draft) {
        console.log('[Evolution] Could not generate skill draft');
        return null;
      }

      // Judge the draft
      const judgment = await this.judgeSkillDraft(draft);

      if (!judgment.approved) {
        console.log(
          `[Evolution] Skill draft rejected: ${judgment.feedback}`
        );
        return null;
      }

      // Create and register the skill
      const skill = this.createSkillFromDraft(draft);

      console.log(
        `[Evolution] Generated new skill: ${skill.frontmatter.name}`
      );

      this.onSkillGenerated?.(skill);
      return skill;
    } catch (error) {
      console.error('[Evolution] Failed to generate skill:', error);
      return null;
    }
  }

  /**
   * Create a skill draft from reflection content
   */
  private async createSkillDraft(
    reflection: Reflection,
    context: ExecutionContext
  ): Promise<SkillDraft | null> {
    // Parse reflection content for skill info
    // In production, this would use LLM to generate structured draft

    try {
      const parsed = JSON.parse(reflection.content);

      return {
        frontmatter: {
          name: parsed.name ?? `auto-skill-${Date.now()}`,
          description: parsed.description ?? `Use when ${parsed.trigger ?? 'task matches skill'}`,
          version: '1.0.0',
          platforms: ['any'],
          metadata: {
            hermes: {
              tags: parsed.tags ?? [],
            },
          },
        },
        content: parsed.content ?? parsed.approach ?? '',
        sourceExperienceId: reflection.id,
        confidence: reflection.confidence,
        generatedAt: Date.now(),
      };
    } catch {
      // Non-JSON content - create basic skill
      return {
        frontmatter: {
          name: `auto-skill-${Date.now()}`,
          description: `Use when ${reflection.content.substring(0, 100)}`,
          version: '1.0.0',
          platforms: ['any'],
        },
        content: reflection.content,
        sourceExperienceId: reflection.id,
        confidence: reflection.confidence,
        generatedAt: Date.now(),
      };
    }
  }

  /**
   * Judge a skill draft (validation)
   *
   * In production, this would use LLM to evaluate:
   * - Is the trigger condition clear?
   * - Is the content actionable?
   * - Does it follow skill conventions?
   */
  private async judgeSkillDraft(draft: SkillDraft): Promise<SkillJudgment> {
    // Basic validation
    if (!draft.frontmatter.name || draft.frontmatter.name.length < 3) {
      return {
        draftId: draft.sourceExperienceId ?? uuidv4(),
        approved: false,
        feedback: 'Skill name too short',
        judgedAt: Date.now(),
      };
    }

    if (!draft.frontmatter.description || draft.frontmatter.description.length < 10) {
      return {
        draftId: draft.sourceExperienceId ?? uuidv4(),
        approved: false,
        feedback: 'Skill description too short',
        judgedAt: Date.now(),
      };
    }

    if (!draft.content || draft.content.length < 50) {
      return {
        draftId: draft.sourceExperienceId ?? uuidv4(),
        approved: false,
        feedback: 'Skill content too short',
        judgedAt: Date.now(),
      };
    }

    // Confidence check
    if (draft.confidence < this.config.skillGenThreshold) {
      return {
        draftId: draft.sourceExperienceId ?? uuidv4(),
        approved: false,
        feedback: `Confidence too low: ${draft.confidence.toFixed(2)}`,
        judgedAt: Date.now(),
      };
    }

    return {
      draftId: draft.sourceExperienceId ?? uuidv4(),
      approved: true,
      judgedAt: Date.now(),
    };
  }

  /**
   * Create Skill object from draft
   */
  private createSkillFromDraft(draft: SkillDraft): Skill {
    return {
      id: createSkillId(draft.frontmatter.name.toLowerCase().replace(/\s+/g, '-')),
      path: `evolution://${draft.frontmatter.name}`,
      frontmatter: draft.frontmatter,
      content: draft.content,
      sections: [],
      createdAt: draft.generatedAt,
      updatedAt: draft.generatedAt,
      isDynamic: true,
    };
  }

  // =========================================================================
  // Experience Management
  // =========================================================================

  /**
   * Add experience record with bounded storage
   */
  private addExperienceRecord(record: ExperienceRecord): void {
    this.experienceRecords.push(record);

    // Enforce max records (FIFO)
    if (this.experienceRecords.length > this.config.maxExperienceRecords) {
      this.experienceRecords.shift();
    }
  }

  /**
   * Get recent experience records
   */
  getRecentExperiences(limit: number = 10): ExperienceRecord[] {
    return this.experienceRecords.slice(-limit);
  }

  /**
   * Search experiences by keywords
   */
  searchExperiences(keywords: string[]): ExperienceRecord[] {
    return this.experienceRecords.filter((record) =>
      keywords.some((kw) =>
        record.keywords.some((k) => k.toLowerCase().includes(kw.toLowerCase()))
      )
    );
  }

  /**
   * Get failed experiences for debugging insights
   */
  getFailures(): ExperienceRecord[] {
    return this.experienceRecords.filter((r) => !r.success);
  }

  // =========================================================================
  // Background Review (Hermes-inspired)
  // =========================================================================

  /**
   * Spawn background reflection review
   *
   * Creates a separate context for analyzing recent execution.
   */
  spawnBackgroundReview(
    conversationHistory: string,
    reviewType: 'skill' | 'memory' | 'improvement' = 'improvement'
  ): Reflection {
    const prompt = REFLECTION_PROMPTS[reviewType];

    const reflection: Reflection = {
      id: uuidv4(),
      taskId: `bg-task-${uuidv4()}` as TaskId,
      timestamp: Date.now(),
      type: reviewType === 'skill' ? 'skill_suggestion' : 'approach_improvement',
      content: `${prompt}\n\n${conversationHistory}`,
      confidence: 0.5, // Will be updated by actual review
      autoGenerated: true,
    };

    // Process asynchronously
    setTimeout(() => {
      this.processReflection(reflection, {
        sessionId: `bg-session-${uuidv4()}` as SessionId,
      });
    }, this.config.reflectionIntervalMs);

    return reflection;
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  /**
   * Extract lessons from error
   */
  private extractLessonsFromError(task: Task, error: TaskError): string[] {
    const lessons: string[] = [];

    if (error.recoverable) {
      lessons.push('Error was recoverable - consider retry mechanism');
    }

    if (error.code) {
      lessons.push(`Error code: ${error.code}`);
    }

    // Task-specific lessons
    if (task.type === 'implementation') {
      lessons.push('Consider TDD approach for implementation tasks');
    } else if (task.type === 'debugging') {
      lessons.push('Apply systematic debugging process');
    }

    return lessons;
  }

  /**
   * Extract lessons from success
   */
  private extractLessonsFromSuccess(_task: Task, result: TaskResult): string[] {
    const lessons: string[] = [];

    if (result.steps && result.steps.length > 0) {
      lessons.push(`Completed in ${result.steps.length} steps`);
    }

    if (result.executionTime) {
      lessons.push(`Execution time: ${result.executionTime}ms`);
    }

    return lessons;
  }

  /**
   * Extract keywords from task
   */
  private extractKeywords(task: Task): string[] {
    const words = task.description
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    return [...new Set(words)].slice(0, 10);
  }

  // =========================================================================
  // Callbacks
  // =========================================================================

  /**
   * Set callback for when skill is generated
   */
  setOnSkillGenerated(callback: (skill: Skill) => void): void {
    this.onSkillGenerated = callback;
  }

  /**
   * Set callback for when experience is stored
   */
  setOnExperienceStored(callback: (entry: MemoryEntry) => void): void {
    this.onExperienceStored = callback;
  }

  // =========================================================================
  // Stats
  // =========================================================================

  /**
   * Get evolution engine stats
   */
  getStats(): EvolutionStats {
    return {
      totalExperiences: this.experienceRecords.length,
      successfulExperiences: this.experienceRecords.filter((r) => r.success).length,
      failedExperiences: this.experienceRecords.filter((r) => !r.success).length,
      pendingSkillDrafts: this.pendingSkillDrafts.length,
      totalReflections: this.reflectionHistory.length,
    };
  }
}

/**
 * Evolution stats
 */
export interface EvolutionStats {
  totalExperiences: number;
  successfulExperiences: number;
  failedExperiences: number;
  pendingSkillDrafts: number;
  totalReflections: number;
}
