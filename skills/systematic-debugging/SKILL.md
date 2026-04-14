---
name: systematic-debugging
description: Use when encountering errors, bugs, crashes, or unexpected behavior
version: 1.0.0
platforms: [any]
metadata:
  hermes:
    tags: [debugging, troubleshooting, error-fixing]
prerequisites:
  skills: []
---

# Systematic Debugging

## Overview
Systematic debugging applies the scientific method to identify root causes and implement minimal, targeted fixes.

## When to Use

- Error messages appear
- Code crashes or hangs
- Unexpected behavior occurs
- Tests are failing
- User reports a bug

## The Iron Law

**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST**

## 4-Phase Process

### Phase 1: Root Cause Investigation

- Read the error message carefully
- Reproduce the issue if possible
- Check recent changes (git diff, commits)
- Trace data flow through the system

### Phase 2: Pattern Analysis

- Find working examples in the codebase
- Compare with broken implementation
- Identify key differences
- Look for similar patterns elsewhere

### Phase 3: Hypothesis and Testing

- Form hypothesis about root cause
- Design minimal experiment to test
- Execute one change at a time
- Verify each hypothesis before proceeding

### Phase 4: Implementation

- Create failing test that reproduces the bug
- Implement minimal fix
- Verify all existing tests still pass
- Clean up any temporary debugging code

## Rules

- Never assume, always verify
- One change at a time
- Document what you tried and why
- If stuck, ask for more context
- Minimal fixes over broad changes
