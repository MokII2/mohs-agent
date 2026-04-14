#!/usr/bin/env node

/**
 * Mohs-agent CLI Entry Point
 */

import { entry } from '../dist/cli/entry.js';

entry().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
