/**
 * Skill Registry
 *
 * Central registry for all skills. Provides:
 * - Skill registration and unregistration
 * - Skill lookup by ID or name
 * - Skill search with relevance scoring
 * - Tag-based filtering
 *
 * Inspired by Hermes' skill system with plugin-like dynamic loading.
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import type {
  Skill,
  SkillId,
  SkillMatch,
  ISkillRegistry,
  SkillFrontmatter,
} from '../../types/index.js';
import { createSkillId } from '../../types/index.js';
import {
  parseSkillMarkdown,
  extractSkillNameFromPath,
  buildSkillIndexEntry,
} from '../markdown-parser/index.js';

const SKILL_INDEX_FILE = 'SKILLS_INDEX.md';

/**
 * In-memory skill store with search capabilities
 */
interface SkillStore {
  byId: Map<SkillId, Skill>;
  byName: Map<string, Skill>;
  byTag: Map<string, Set<SkillId>>;
}

/**
 * Default skill registry implementation
 */
export class SkillRegistry implements ISkillRegistry {
  private readonly store: SkillStore = {
    byId: new Map(),
    byName: new Map(),
    byTag: new Map(),
  };

  private skillsDir?: string;
  private indexCache?: string;
  private indexCacheMtime?: number;

  constructor(skillsDir?: string) {
    if (skillsDir) {
      this.skillsDir = skillsDir;
    }
  }

  // =========================================================================
  // Registration
  // =========================================================================

  /**
   * Register a skill
   */
  register(skill: Skill): void {
    const { id, frontmatter } = skill;

    // Store by ID
    this.store.byId.set(id, skill);

    // Store by name (case-insensitive)
    this.store.byName.set(frontmatter.name.toLowerCase(), skill);

    // Index by tags
    const tags = frontmatter.metadata?.hermes?.tags ?? [];
    for (const tag of tags) {
      if (!this.store.byTag.has(tag)) {
        this.store.byTag.set(tag, new Set());
      }
      this.store.byTag.get(tag)!.add(id);
    }

    // Clear index cache
    this.indexCache = undefined;
  }

  /**
   * Unregister a skill
   */
  unregister(skillId: SkillId): boolean {
    const skill = this.store.byId.get(skillId);
    if (!skill) return false;

    // Remove from all indices
    this.store.byId.delete(skillId);
    this.store.byName.delete(skill.frontmatter.name.toLowerCase());

    // Remove from tag indices
    const tags = skill.frontmatter.metadata?.hermes?.tags ?? [];
    for (const tag of tags) {
      this.store.byTag.get(tag)?.delete(skillId);
    }

    // Clear index cache
    this.indexCache = undefined;

    return true;
  }

  // =========================================================================
  // Lookup
  // =========================================================================

  /**
   * Get skill by ID
   */
  get(skillId: SkillId): Skill | undefined {
    return this.store.byId.get(skillId);
  }

  /**
   * Find skill by name (case-insensitive)
   */
  findByName(name: string): Skill | undefined {
    return this.store.byName.get(name.toLowerCase());
  }

  /**
   * Get all registered skills
   */
  getAll(): Skill[] {
    return Array.from(this.store.byId.values());
  }

  /**
   * Get skills by tag
   */
  getByTag(tag: string): Skill[] {
    const skillIds = this.store.byTag.get(tag);
    if (!skillIds) return [];
    return Array.from(skillIds)
      .map((id) => this.store.byId.get(id))
      .filter((s): s is Skill => s !== undefined);
  }

  // =========================================================================
  // Search
  // =========================================================================

  /**
   * Search skills by query
   *
   * Uses simple keyword matching and relevance scoring:
   * 1. Description match (highest weight)
   * 2. Content match (medium weight)
   * 3. Tag match (medium weight)
   * 4. Metadata match (lower weight)
   */
  async search(query: string, topK: number = 5): Promise<SkillMatch[]> {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(Boolean);

    const scores: Array<{ skill: Skill; score: number; matchedOn: SkillMatch['matchedOn'] }> = [];

    for (const skill of this.store.byId.values()) {
      let bestScore = 0;
      let matchedOn: SkillMatch['matchedOn'] = 'description';

      // 1. Description match (weight: 0.5)
      const descLower = skill.frontmatter.description.toLowerCase();
      const descMatches = queryWords.filter((w) => descLower.includes(w)).length;
      const descScore = descMatches / queryWords.length * 0.5;
      if (descScore > bestScore) {
        bestScore = descScore;
        matchedOn = 'description';
      }

      // 2. Content match (weight: 0.3)
      const contentLower = skill.content.toLowerCase();
      const contentMatches = queryWords.filter((w) => contentLower.includes(w)).length;
      const contentScore = contentMatches / queryWords.length * 0.3;
      if (contentScore > bestScore) {
        bestScore = contentScore;
        matchedOn = 'content';
      }

      // 3. Tag match (weight: 0.2)
      const tags = skill.frontmatter.metadata?.hermes?.tags ?? [];
      const tagMatches = queryWords.filter((w) => tags.some((t) => t.toLowerCase().includes(w))).length;
      const tagScore = tagMatches / queryWords.length * 0.2;
      if (tagScore > bestScore) {
        bestScore = tagScore;
        matchedOn = 'tags';
      }

      if (bestScore > 0) {
        scores.push({ skill, score: bestScore, matchedOn });
      }
    }

    // Sort by score descending and take top K
    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, topK).map((s) => ({
      skill: s.skill,
      relevanceScore: s.score,
      matchedOn: s.matchedOn,
    }));
  }

  // =========================================================================
  // Index Generation
  // =========================================================================

  /**
   * Generate skills index for system prompt injection
   *
   * This creates a markdown index of all skills, optimized for
   * Claude's context retrieval (Claude Search Optimization principle).
   */
  async generateIndex(): Promise<string> {
    // Check cache
    if (this.indexCache && this.skillsDir) {
      try {
        const mtime = (await stat(this.skillsDir)).mtimeMs;
        if (this.indexCacheMtime === mtime) {
          return this.indexCache;
        }
      } catch {
        // Ignore stat errors
      }
    }

    const skills = this.getAll();

    if (skills.length === 0) {
      this.indexCache = '';
      return '';
    }

    const lines: string[] = [
      '# Available Skills',
      '',
      'Use these skills when relevant to the user\'s request. Skill names are in **bold**.',
      '',
    ];

    for (const skill of skills) {
      lines.push(buildSkillIndexEntry(skill));
      lines.push('');
    }

    const index = lines.join('\n');
    this.indexCache = index;

    if (this.skillsDir) {
      try {
        this.indexCacheMtime = (await stat(this.skillsDir)).mtimeMs;
      } catch {
        // Ignore
      }
    }

    return index;
  }

  /**
   * Save skills index to file
   */
  async saveIndexToFile(filePath: string): Promise<void> {
    const { writeFile } = await import('fs/promises');
    const index = await this.generateIndex();
    await writeFile(filePath, index, 'utf-8');
  }

  // =========================================================================
  // File-based Loading
  // =========================================================================

  /**
   * Load skills from directory
   *
   * Recursively scans for SKILL.md files and registers them.
   */
  async loadFromDirectory(dirPath: string): Promise<number> {
    this.skillsDir = dirPath;
    let count = 0;

    try {
      await this.scanDirectory(dirPath, (skill) => {
        this.register(skill);
        count++;
      });
    } catch (error) {
      console.error(`[SkillRegistry] Failed to load skills from ${dirPath}:`, error);
    }

    console.log(`[SkillRegistry] Loaded ${count} skills from ${dirPath}`);
    return count;
  }

  /**
   * Recursively scan directory for SKILL.md files
   */
  private async scanDirectory(
    dirPath: string,
    callback: (skill: Skill) => void
  ): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Check if this directory contains a SKILL.md
        const skillPath = join(fullPath, 'SKILL.md');
        try {
          const content = await readFile(skillPath, 'utf-8');
          const skill = parseSkillMarkdown(content, skillPath);
          callback(skill);
        } catch {
          // Not a skill directory, recurse
          await this.scanDirectory(fullPath, callback);
        }
      } else if (entry.name === 'SKILL.md') {
        const content = await readFile(fullPath, 'utf-8');
        const skill = parseSkillMarkdown(content, fullPath);
        callback(skill);
      }
    }
  }

  // =========================================================================
  // Dynamic Skill Registration (Hermes-inspired)
  // =========================================================================

  /**
   * Register a dynamically generated skill
   *
   * Used by the evolution engine to register auto-generated skills.
   */
  registerDynamicSkill(
    frontmatter: SkillFrontmatter,
    content: string
  ): Skill {
    const id = createSkillId(frontmatter.name.toLowerCase().replace(/\s+/g, '-'));

    const skill: Skill = {
      id,
      path: `dynamic://${id}`,
      frontmatter,
      content,
      sections: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDynamic: true,
    };

    this.register(skill);
    return skill;
  }

  /**
   * Get count of registered skills
   */
  get count(): number {
    return this.store.byId.size;
  }
}

// Export singleton factory
let defaultRegistry: SkillRegistry | undefined;

export function getDefaultRegistry(): SkillRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new SkillRegistry();
  }
  return defaultRegistry;
}
