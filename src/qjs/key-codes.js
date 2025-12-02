export const KEY_CODES = {
  CTRL_C: 3,
  BACKSPACE: 8,
  ENTER_CR: 10,
  ENTER_LF: 13,
  ESCAPE: 27,
  BRACKET: 91,
  ARROW_UP: 65,
  ARROW_DOWN: 66,
  Q: 113,
  DELETE: 127,
  PRINTABLE_START: 32,
  PRINTABLE_END: 127,
};

export const COLORS = {
  CYAN: "\x1b[36m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  GRAY: "\x1b[90m",
  DIM: "\x1b[2m",
  BOLD: "\x1b[1m",
  RESET: "\x1b[0m",
};

export const TERMINAL = {
  HIDE_CURSOR: "\x1b[?25l",
  SHOW_CURSOR: "\x1b[?25h",
  CLEAR_SCREEN: "\x1b[2J\x1b[H",
};

export const MAX_VISIBLE = 10;
