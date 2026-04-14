/**
 * CLI Console Utilities
 *
 * Styled console output for CLI.
 */

/**
 * Console colors
 */
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

/**
 * Style functions
 */
export const style = {
  bold: (text: string) => `${colors.bold}${text}${colors.reset}`,
  dim: (text: string) => `${colors.dim}${text}${colors.reset}`,
  red: (text: string) => `${colors.red}${text}${colors.reset}`,
  green: (text: string) => `${colors.green}${text}${colors.reset}`,
  yellow: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  blue: (text: string) => `${colors.blue}${text}${colors.reset}`,
  magenta: (text: string) => `${colors.magenta}${text}${colors.reset}`,
  cyan: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  white: (text: string) => `${colors.white}${text}${colors.reset}`,
  gray: (text: string) => `${colors.gray}${text}${colors.reset}`,
};

/**
 * Print a header
 */
export function printHeader(text: string): void {
  console.log('');
  console.log(style.bold(style.cyan(`╭─ ${text} ─`)));
  console.log(style.cyan('│'));
}

/**
 * Print a footer
 */
export function printFooter(): void {
  console.log(style.cyan('│'));
  console.log(style.cyan('╰────────────────────────────────────'));
  console.log('');
}

/**
 * Print a key-value pair
 */
export function printKeyValue(key: string, value: string, indent = 0): void {
  const prefix = ' '.repeat(indent);
  console.log(`${prefix}${style.cyan('·')} ${style.bold(key)}: ${value}`);
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  console.log(`${style.green('✓')} ${message}`);
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  console.error(`${style.red('✗')} ${message}`);
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  console.warn(`${style.yellow('⚠')} ${message}`);
}

/**
 * Print an info message
 */
export function printInfo(message: string): void {
  console.log(`${style.blue('ℹ')} ${message}`);
}

/**
 * Print a section header
 */
export function printSection(name: string): void {
  console.log('');
  console.log(style.bold(`${name}`));
  console.log(style.dim('─'.repeat(40)));
}

/**
 * Print a table row
 */
export function printTableRow(columns: string[], widths: number[]): void {
  const row = columns.map((col, i) => col.padEnd(widths[i])).join(' | ');
  console.log(style.dim('│ ') + row + style.dim(' │'));
}

/**
 * Print a table header
 */
export function printTableHeader(columns: string[], widths: number[]): void {
  printTableRow(columns, widths);
  console.log(widths.map((w) => style.dim('─'.repeat(w))).join('-+-'));
}

/**
 * Clear line
 */
export function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}

/**
 * Write to same line
 */
export function writeSameLine(text: string): void {
  clearLine();
  process.stdout.write(text);
}

/**
 * Print spinner
 */
export function printSpinner(text: string): () => void {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let index = 0;
  let interval: NodeJS.Timeout;

  const stop = () => {
    clearInterval(interval);
    clearLine();
  };

  interval = setInterval(() => {
    process.stdout.write(`\r${frames[index++ % frames.length]} ${text}`);
  }, 80);

  return stop;
}
