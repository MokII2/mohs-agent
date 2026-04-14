/**
 * Skill Markdown Parser
 *
 * Parses SKILL.md files following the Superpowers convention:
 *
 * ```yaml
 * ---
 * name: skill-name
 * description: Use when...
 * version: 1.0.0
 * platforms: [macos, linux]
 * metadata:
 *   hermes:
 *     tags: [tag1, tag2]
 * prerequisites:
 *   commands: [cmd1]
 *   tools: [tool1]
 * ---
 *
 * # Skill Name
 *
 * ## Overview
 * ...
 *
 * ## When to Use
 * ...
 *
 * ## Rules
 * ...
 * ```
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
  Skill,
  SkillFrontmatter,
  SkillSection,
  SkillId,
} from '../../types/index.js';
import { createSkillId } from '../../types/index.js';

const SKILL_FILE_NAME = 'SKILL.md';
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
const SECTION_HEADING_REGEX = /^#{1,6}\s+(.+)$/;

/**
 * Parse a SKILL.md file content into a Skill object
 */
export function parseSkillMarkdown(
  content: string,
  path: string
): Skill {
  const frontmatterMatch = content.match(FRONTMATTER_REGEX);

  if (!frontmatterMatch) {
    throw new Error(`Invalid SKILL.md format: missing frontmatter in ${path}`);
  }

  const [, frontmatterYaml, markdownContent] = frontmatterMatch;
  const frontmatter = parseYaml(frontmatterYaml) as SkillFrontmatter;

  // Validate required frontmatter fields
  if (!frontmatter.name) {
    throw new Error(`Skill missing required 'name' field in ${path}`);
  }
  if (!frontmatter.description) {
    throw new Error(`Skill missing required 'description' field in ${path}`);
  }

  // Parse sections from markdown content
  const sections = parseSections(markdownContent);

  return {
    id: createSkillId(frontmatter.name.toLowerCase().replace(/\s+/g, '-')),
    path,
    frontmatter,
    content: markdownContent.trim(),
    sections,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Parse markdown content into sections
 */
function parseSections(content: string): SkillSection[] {
  const lines = content.split('\n');
  const sections: SkillSection[] = [];
  let currentSection: SkillSection | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(SECTION_HEADING_REGEX);

    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection);
      }

      // Start new section
      const headingText = headingMatch[1];
      currentSection = {
        name: headingText,
        level: line.match(/^#+/)![0].length,
        content: '',
      };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim();
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Generate SKILL.md content from Skill object
 */
export function generateSkillMarkdown(skill: Skill): string {
  const frontmatter = stringifyYaml(skill.frontmatter, {
    indent: 2,
    lineWidth: 0,
  }).trim();

  return `---\n${frontmatter}\n---\n\n# ${skill.frontmatter.name}\n\n${skill.content}`;
}

/**
 * Extract skill name from path
 */
export function extractSkillNameFromPath(path: string): string | null {
  const match = path.match(/\/skills\/([^/]+)\/SKILL\.md$/);
  return match?.[1] ?? null;
}

/**
 * Get section by name from skill
 */
export function getSkillSection(skill: Skill, sectionName: string): SkillSection | undefined {
  return skill.sections.find(
    (s) => s.name.toLowerCase() === sectionName.toLowerCase()
  );
}

/**
 * Get "When to Use" section content
 */
export function getWhenToUse(skill: Skill): string {
  // Try different possible section names
  const whenToUse = getSkillSection(skill, 'When to Use')
    ?? getSkillSection(skill, 'when to use')
    ?? getSkillSection(skill, 'When to use')
    ?? getSkillSection(skill, 'Usage');

  return whenToUse?.content ?? skill.frontmatter.description;
}

/**
 * Get rules section content
 */
export function getSkillRules(skill: Skill): string[] {
  const rulesSection = getSkillSection(skill, 'Rules')
    ?? getSkillSection(skill, 'rules')
    ?? getSkillSection(skill, 'Guidelines');

  if (!rulesSection) return [];

  // Split by numbered items or bullet points
  return rulesSection.content
    .split(/\n(?=\d+\.|[-*])\s*/)
    .map((r) => r.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Get prerequisites from skill
 */
export function getPrerequisites(skill: Skill): SkillFrontmatter['prerequisites'] {
  return skill.frontmatter.prerequisites;
}

/**
 * Check if skill is available for platform
 */
export function isAvailableForPlatform(skill: Skill, platform: string): boolean {
  const platforms = skill.frontmatter.platforms;
  if (!platforms || platforms.length === 0) return true;
  return platforms.includes(platform);
}

/**
 * Build skill index entry for system prompt
 *
 * This creates a compact representation of a skill for injection
 * into the agent's system prompt.
 */
export function buildSkillIndexEntry(skill: Skill): string {
  const lines: string[] = [];

  lines.push(`### ${skill.frontmatter.name}`);
  lines.push(`**When to use:** ${skill.frontmatter.description}`);

  if (skill.frontmatter.prerequisites) {
    const prereqs = skill.frontmatter.prerequisites;
    const reqs: string[] = [];
    if (prereqs.commands?.length) reqs.push(`commands: ${prereqs.commands.join(', ')}`);
    if (prereqs.tools?.length) reqs.push(`tools: ${prereqs.tools.join(', ')}`);
    if (reqs.length) lines.push(`**Prerequisites:** ${reqs.join(' | ')}`);
  }

  return lines.join('\n');
}
