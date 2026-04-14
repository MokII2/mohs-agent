/**
 * CLI Interactive Prompts
 *
 * User interaction utilities.
 */

import { createInterface } from 'readline';

/**
 * Question options
 */
export interface QuestionOptions {
  default?: string;
  password?: boolean;
  validator?: (input: string) => boolean | string;
}

/**
 * Ask a question
 */
export async function question(
  text: string,
  options: QuestionOptions = {}
): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = options.password
    ? `${text}: `
    : `${text}${options.default ? ` [${options.default}]` : ''}: `;

  return new Promise((resolve): void => {
    rl.question(prompt, (answer): void => {
      rl.close();

      const value = answer.trim() || options.default || '';

      if (options.validator) {
        const result = options.validator(value);
        if (result !== true) {
          console.log(typeof result === 'string' ? result : 'Invalid input');
          question(text, options).then(resolve);
          return;
        }
      }

      resolve(value);
    });
  });
}

/**
 * Ask for password (no echo)
 */
export async function password(text: string): Promise<string> {
  // For now, just use question (in production would use node-password-prompts or similar)
  return question(text, { password: true });
}

/**
 * Confirm a question
 */
export async function confirm(text: string, defaultValue = true): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';

  return new Promise((resolve): void => {
    rl.question(`${text}${suffix}: `, (answer): void => {
      rl.close();

      if (!answer.trim()) {
        resolve(defaultValue);
        return;
      }

      const lower = answer.toLowerCase()[0];
      resolve(lower === 'y');
    });
  });
}

/**
 * Select from options
 */
export async function select<T>(
  text: string,
  options: Array<{ label: string; value: T }>
): Promise<T> {
  console.log('');
  console.log(text);
  console.log('');

  for (let i = 0; i < options.length; i++) {
    console.log(`  ${i + 1}. ${options[i].label}`);
  }
  console.log('');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve): void => {
    rl.question('Select option: ', (answer): void => {
      rl.close();

      const index = parseInt(answer, 10) - 1;

      if (isNaN(index) || index < 0 || index >= options.length) {
        console.log('Invalid selection');
        select(text, options).then(resolve);
        return;
      }

      resolve(options[index].value);
    });
  });
}

/**
 * Multi-select
 */
export async function multiSelect<T>(
  text: string,
  options: Array<{ label: string; value: T }>
): Promise<T[]> {
  console.log('');
  console.log(text);
  console.log('(Press SPACE to select, ENTER to confirm)');
  console.log('');

  for (let i = 0; i < options.length; i++) {
    console.log(`  [ ] ${options[i].label}`);
  }
  console.log('');

  // Simplified: just return all selected
  // In production would use arrow-key selection
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve): void => {
    rl.question('Select indices (comma-separated): ', (answer): void => {
      rl.close();

      if (!answer.trim()) {
        resolve([]);
        return;
      }

      const indices = answer.split(',').map((s) => parseInt(s.trim(), 10) - 1);
      const selected = indices
        .filter((i) => !isNaN(i) && i >= 0 && i < options.length)
        .map((i) => options[i].value);

      resolve(selected);
    });
  });
}
