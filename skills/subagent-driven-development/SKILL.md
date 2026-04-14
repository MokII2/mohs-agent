---
name: subagent-driven-development
description: Use when implementing a multi-step plan with distinct phases
version: 1.0.0
platforms: [any]
metadata:
  hermes:
    tags: [implementation, planning, development]
prerequisites:
  skills: [tdd, systematic-debugging]
---

# Subagent-Driven Development

## Overview
Orchestrate complex implementations by dispatching specialized subagents for different phases, maintaining context isolation between them.

## When to Use

- Large implementation tasks with multiple phases
- Tasks requiring different expertise (implement, review, test)
- When a plan exists with distinct steps
- Complex features that need systematic execution

## Context Isolation Principle

**Subagents should NEVER inherit the parent session's context or history.**

The controller (main agent) constructs exactly what each subagent needs:
- Task description (paste verbatim from plan)
- Context (scene-setting, dependencies)
- Working directory
- No session history or previous context

## Execution Flow

```
Task Submitted
     │
     ▼
┌─────────────────┐
│ Controller      │
│ (Main Agent)     │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Implementer     │ ← Fresh context, specific task
│ Subagent        │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Spec Reviewer   │ ← Verify WHAT was built
│ Subagent        │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Code Quality    │ ← Verify HOW it was built
│ Reviewer        │
└─────────────────┘
```

## Subagent Types

### Implementer
- Implements exactly what the task specifies
- Writes tests following TDD
- Self-reviews before reporting

### Spec Reviewer
- Verifies implementation matches spec
- Checks for missing/extra work
- Does NOT trust implementer report

### Code Quality Reviewer
- Verifies clean, tested, maintainable code
- Requires spec compliance first

## Before Dispatching

Always provide:
- `{TASK_DESCRIPTION}` - Full text from plan
- `{CONTEXT}` - Relevant background
- `{WORKSPACE}` - Working directory path
- `{BASE_SHA}` - Git reference (if applicable)
