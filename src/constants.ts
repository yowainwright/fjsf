export const ANSI = {
  CLEAR_SCREEN: "\x1b[2J\x1b[H",
  HIDE_CURSOR: "\x1b[?25l",
  SHOW_CURSOR: "\x1b[?25h",
  SAVE_CURSOR: "\x1b[s",
  RESTORE_CURSOR: "\x1b[u",
  CLEAR_LINE: "\x1b[2K",
  MOVE_UP: "\x1b[1A",
  RESET: "\x1b[0m",
  BRIGHT: "\x1b[1m",
  DIM: "\x1b[2m",
  CYAN: "\x1b[36m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  GRAY: "\x1b[90m",
} as const;

export const moveCursorTo = (x: number, y: number): string => `\x1b[${y};${x}H`;
