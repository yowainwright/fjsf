import { stdout } from 'process';

export const clearScreen = (): void => {
  stdout.write('\x1b[2J\x1b[H');
};

export const moveCursor = (x: number, y: number): void => {
  stdout.write(`\x1b[${y};${x}H`);
};

export const hideCursor = (): void => {
  stdout.write('\x1b[?25l');
};

export const showCursor = (): void => {
  stdout.write('\x1b[?25h');
};

export const enableRawMode = (): void => {
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
};

export const disableRawMode = (): void => {
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();
};

export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

export const colorize = (text: string, color: string): string => `${color}${text}${colors.reset}`;

export const highlightMatches = (text: string, matches: number[]): string => {
  const chars = text.split('');
  return chars
    .map((char, idx) =>
      matches.includes(idx) ? colorize(char, colors.bright + colors.cyan) : char
    )
    .join('');
};
