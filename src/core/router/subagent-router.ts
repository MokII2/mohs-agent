/**
 * Subagent Router - Intelligent Task Routing System
 *
 * Inspired by Superpowers' subagent-driven-development pattern, this router
 * analyzes tasks and routes them to appropriate specialized subagents.
 *
 * Key principles from Superpowers:
 * 1. Never inherit session context in subagents - construct fresh context
 * 2. Match tasks to subagent types based on skill signatures
 * 3. Support full context isolation when required
 */

import type {
  Task,
  RoutingDecision,
  SkillMatch,
  SubagentDefinition,
  ISkillRegistry,
  SubagentContext,
} from '../../types/index.js';

/**
 * Skill-to-subagent mapping
 */
interface SubagentSkillMapping {
  subagentType: string;
  requiredSkills: string[];
  preferredSkills: string[];
  keywords: string[];
}

/**
 * Built-in subagent type definitions
 */
const BUILTIN_SUBAGENTS: Record<string, SubagentDefinition> = {
  'code-implementer': {
    type: 'code-implementer',
    name: 'Code Implementer',
    description: 'Implements code based on specifications with TDD approach',
    systemPromptTemplate: `You are implementing a task from a plan.

## Your Role
Implement exactly what the task specifies. Write clean, tested code following TDD principles.

## Context Isolation Principle
You should NEVER inherit the parent session's context or history.
The controller provides exactly what you need in the task description.

## Before You Begin
- Read the task description carefully
- Ask clarifying questions if anything is unclear
- Do NOT proceed until you understand the requirements

## During Implementation
- Write a failing test first (TDD)
- Implement the minimum code to pass
- Refactor as needed
- Self-review before reporting

## Reporting
Report your status as one of:
- DONE: Task completed successfully
- DONE_WITH_CONCERNS: Completed but has issues to note
- BLOCKED: Cannot proceed due to blocker
- NEEDS_CONTEXT: Need more information to proceed`,
    skills: [],
    tools: ['file_read', 'file_write', 'terminal'],
    isolationLevel: 'full',
  },

  'spec-reviewer': {
    type: 'spec-reviewer',
    name: 'Spec Compliance Reviewer',
    description: 'Verifies implementation matches specification exactly',
    systemPromptTemplate: `You are a Spec Compliance Reviewer.

## Your Role
Verify that implementation matches specification exactly - nothing more, nothing less.

## Critical Rule
DO NOT TRUST THE REPORT - verify by reading actual code!

## What to Check
- Missing requirements from spec
- Extra work not in spec
- Misunderstandings of requirements
- Incorrect implementation details

## Context Isolation
You receive isolated context with:
- WHAT_WAS_IMPLEMENTED: Direct claims from implementer
- PLAN_OR_REQUIREMENTS: Source of truth for spec
- DESCRIPTION: Summary of the task

Verify claims against the actual code.`,
    skills: [],
    tools: ['file_read', 'code_search'],
    isolationLevel: 'full',
  },

  'code-quality-reviewer': {
    type: 'code-quality-reviewer',
    name: 'Code Quality Reviewer',
    description: 'Reviews code quality, testing, and maintainability',
    systemPromptTemplate: `You are a Code Quality Reviewer.

## Prerequisites
Spec compliance review MUST pass before this review.

## Your Role
Verify implementation is well-built: clean, tested, maintainable.

## Focus Areas
- File organization and single responsibility
- Units decomposed for independent testing
- Following file structure from plan
- File size contributions
- Test coverage and quality
- Error handling
- Documentation

## Context Isolation
You receive fresh context - do not assume previous knowledge of the codebase.`,
    skills: [],
    tools: ['file_read', 'code_search', 'terminal'],
    isolationLevel: 'full',
  },

  'code-reviewer': {
    type: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Comprehensive code review with plan alignment analysis',
    systemPromptTemplate: `You are a comprehensive Code Reviewer.

## Review Dimensions
1. Plan Alignment Analysis - Does code match the plan?
2. Code Quality Assessment - Clean, tested, maintainable?
3. Architecture and Design - Good structure?
4. Documentation and Standards - Properly documented?
5. Issue Identification - Critical/Important/Minor issues

## Process
1. Read the plan/requirements
2. Read the implementation
3. Compare and analyze
4. Provide structured feedback

## Context Isolation
Never inherit session context. The task description provides all needed context.`,
    skills: [],
    tools: ['file_read', 'code_search', 'git_diff'],
    isolationLevel: 'full',
  },

  'brainstormer': {
    type: 'brainstormer',
    name: 'Brainstorming Agent',
    description: 'Explores design options and creates specifications',
    systemPromptTemplate: `You are a Brainstorming Agent.

## Process
1. Explore project context
2. Offer visual companion if needed
3. Ask clarifying questions ONE AT A TIME
4. Propose 2-3 approaches with trade-offs
5. Present design in sections
6. Write design doc
7. Spec self-review
8. User reviews spec
9. Transition to writing-plans

## Hard Gate
Do NOT invoke any implementation skill until you have presented a design and user has approved it.`,
    skills: [],
    tools: ['file_read', 'web_search'],
    isolationLevel: 'partial',
  },

  'debugger': {
    type: 'debugger',
    name: 'Systematic Debugger',
    description: 'Systematic debugging using scientific method',
    systemPromptTemplate: `You are a Systematic Debugging Agent.

## The Iron Law
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST

## 4-Phase Process

### Phase 1: Root Cause Investigation
- Read errors carefully
- Reproduce the issue
- Check recent changes
- Trace data flow

### Phase 2: Pattern Analysis
- Find working examples
- Compare with broken code
- Identify differences

### Phase 3: Hypothesis and Testing
- Form hypothesis about root cause
- Design experiments to test
- Execute systematically

### Phase 4: Implementation
- Create failing test first
- Implement minimal fix
- Verify all tests pass`,
    skills: [],
    tools: ['file_read', 'terminal', 'debugger'],
    isolationLevel: 'full',
  },

  'general': {
    type: 'general',
    name: 'General Purpose Agent',
    description: 'Handles general tasks without specific domain expertise',
    systemPromptTemplate: `You are a general-purpose agent.

## Your Capabilities
- Answer questions
- Analyze information
- Provide explanations
- Assist with various tasks

## Guidelines
- Be clear and concise
- Ask for clarification when needed
- Use available tools appropriately
- Request specific context if missing`,
    skills: [],
    tools: ['web_search', 'file_read'],
    isolationLevel: 'partial',
  },
};

/**
 * Subagent Router class
 */
export class SubagentRouter {
  private readonly customSubagents: Map<string, SubagentDefinition> = new Map();
  private readonly skillMappings: SubagentSkillMapping[] = [];
  private skillRegistry?: ISkillRegistry;

  constructor() {
    // Register built-in mappings
    this.initializeDefaultMappings();
  }

  /**
   * Set skill registry for better routing decisions
   */
  setSkillRegistry(registry: ISkillRegistry): void {
    this.skillRegistry = registry;
  }

  /**
   * Register a custom subagent type
   */
  registerSubagent(definition: SubagentDefinition): void {
    this.customSubagents.set(definition.type, definition);
  }

  /**
   * Get all subagent types (built-in + custom)
   */
  getAllSubagents(): SubagentDefinition[] {
    return [
      ...Object.values(BUILTIN_SUBAGENTS),
      ...Array.from(this.customSubagents.values()),
    ];
  }

  /**
   * Get subagent definition by type
   */
  getSubagent(type: string): SubagentDefinition | undefined {
    return this.customSubagents.get(type) ?? BUILTIN_SUBAGENTS[type];
  }

  /**
   * Route a task to appropriate subagent
   *
   * This implements the core routing logic:
   * 1. Match task description against skill keywords
   * 2. Consider skill matches from registry
   * 3. Determine best subagent type
   * 4. Calculate confidence score
   */
  route(task: Task, skillMatches: SkillMatch[]): RoutingDecision {
    const allSubagents = this.getAllSubagents();

    // Score each subagent for this task
    const scores = allSubagents.map((subagent) => ({
      subagent,
      score: this.calculateSubagentScore(task, subagent, skillMatches),
    }));

    // Sort by score descending
    scores.sort((a, b) => b.score.total - a.score.total);

    const best = scores[0];

    return {
      subagentType: best.subagent.type,
      matchedSkills: skillMatches.slice(0, 5),
      confidence: best.score.total,
      reasoning: this.generateRoutingReasoning(best),
    };
  }

  /**
   * Build context for subagent execution
   *
   * This implements the Superpowers principle: construct exactly what
   * the subagent needs, never inherit session history.
   */
  buildSubagentContext(
    task: Task,
    subagentType: string,
    additionalContext: Record<string, unknown> = {}
  ): SubagentContext {
    const subagent = this.getSubagent(subagentType);

    return {
      task,
      relevantContext: this.extractRelevantContext(task, subagent),
      workspacePath: additionalContext.workspacePath as string | undefined,
      baseSha: additionalContext.baseSha as string | undefined,
      headSha: additionalContext.headSha as string | undefined,
    };
  }

  /**
   * Calculate score for subagent-task match
   */
  private calculateSubagentScore(
    task: Task,
    subagent: SubagentDefinition,
    skillMatches: SkillMatch[]
  ): { total: number; breakdown: Record<string, number> } {
    let total = 0;
    const breakdown: Record<string, number> = {};

    // 1. Direct type matching by task.subagentType
    if (task.subagentType === subagent.type) {
      breakdown.typeMatch = 0.5;
      total += 0.5;
    }

    // 2. Skill match scoring
    const matchedSkillIds = new Set(skillMatches.map((m) => m.skill.id));
    const subagentRequiredSkills = this.getSubagentRequiredSkills(subagent.type);

    const requiredMatch = subagentRequiredSkills.filter((s) =>
      matchedSkillIds.has(s as unknown as import('../../types/index.js').SkillId)
    ).length;
    breakdown.requiredSkillMatch = (requiredMatch / Math.max(subagentRequiredSkills.length, 1)) * 0.3;
    total += breakdown.requiredSkillMatch;

    // 3. Task type keyword matching
    const taskKeywords = this.extractKeywords(task.description);
    const subagentKeywords = this.getSubagentKeywords(subagent.type);

    const keywordOverlap = taskKeywords.filter((k) =>
      subagentKeywords.includes(k)
    ).length;
    breakdown.keywordMatch = Math.min(keywordOverlap / Math.max(taskKeywords.length, 1), 1) * 0.2;
    total += breakdown.keywordMatch;

    // Normalize to 0-1
    total = Math.min(total, 1);

    return { total, breakdown };
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in production, use NLP
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    ]);

    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    return [...new Set(words)];
  }

  /**
   * Get required skills for subagent type
   */
  private getSubagentRequiredSkills(subagentType: string): string[] {
    const mapping = this.skillMappings.find((m) => m.subagentType === subagentType);
    return mapping?.requiredSkills ?? [];
  }

  /**
   * Get keywords for subagent type
   */
  private getSubagentKeywords(subagentType: string): string[] {
    const mapping = this.skillMappings.find((m) => m.subagentType === subagentType);
    return mapping?.keywords ?? [];
  }

  /**
   * Generate routing reasoning
   */
  private generateRoutingReasoning(
    best: { subagent: SubagentDefinition; score: { breakdown: Record<string, number> } }
  ): string {
    const parts: string[] = [];
    const breakdown = best.score.breakdown;

    if (breakdown.typeMatch > 0) {
      parts.push(`Direct type match (${(breakdown.typeMatch * 100).toFixed(0)}%)`);
    }
    if (breakdown.requiredSkillMatch > 0) {
      parts.push(`Required skill match (${(breakdown.requiredSkillMatch * 100).toFixed(0)}%)`);
    }
    if (breakdown.keywordMatch > 0) {
      parts.push(`Keyword overlap (${(breakdown.keywordMatch * 100).toFixed(0)}%)`);
    }

    return `Selected ${best.subagent.name} because: ${parts.join(', ')}`;
  }

  /**
   * Extract relevant context for subagent
   *
   * Context isolation principle from Superpowers:
   * Subagents should only receive task-specific context,
   * never full session history.
   */
  private extractRelevantContext(task: Task, subagent?: SubagentDefinition): string {
    const parts: string[] = [
      `Task: ${task.description}`,
    ];

    if (task.input.query) {
      parts.push(`Query: ${task.input.query}`);
    }

    if (task.input.constraints?.length) {
      parts.push(`Constraints: ${task.input.constraints.join(', ')}`);
    }

    if (task.input.expectedOutput) {
      parts.push(`Expected Output: ${task.input.expectedOutput}`);
    }

    return parts.join('\n');
  }

  /**
   * Initialize default skill-to-subagent mappings
   */
  private initializeDefaultMappings(): void {
    this.skillMappings.push(
      {
        subagentType: 'code-implementer',
        requiredSkills: ['tdd', 'implementation'],
        preferredSkills: ['testing', 'refactoring'],
        keywords: ['implement', 'code', 'write', 'function', 'class', 'feature', 'build'],
      },
      {
        subagentType: 'spec-reviewer',
        requiredSkills: ['review', 'specification'],
        preferredSkills: ['compliance'],
        keywords: ['verify', 'check', 'spec', 'requirement', 'compliance', 'validate'],
      },
      {
        subagentType: 'code-quality-reviewer',
        requiredSkills: ['code-review', 'quality'],
        preferredSkills: ['testing', 'maintainability'],
        keywords: ['quality', 'review', 'test', 'refactor', 'clean', 'maintain'],
      },
      {
        subagentType: 'code-reviewer',
        requiredSkills: ['code-review'],
        preferredSkills: ['architecture', 'design'],
        keywords: ['review', 'pr', 'pull-request', 'change', 'diff'],
      },
      {
        subagentType: 'brainstormer',
        requiredSkills: ['brainstorming', 'design'],
        preferredSkills: ['architecture'],
        keywords: ['design', 'brainstorm', 'approach', '方案', '设计', '思考'],
      },
      {
        subagentType: 'debugger',
        requiredSkills: ['debugging', 'systematic-debugging'],
        preferredSkills: ['troubleshooting'],
        keywords: ['debug', 'bug', 'error', 'crash', 'fix', 'issue', '问题', '错误', '调试'],
      }
    );
  }
}
