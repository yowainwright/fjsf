import { updateSelection, getSelectedScript } from "./state.ts";
import { updateQuery } from "./search.ts";
import { executeScript } from "./executor.ts";
import type { State } from "./state.ts";

const KEYS = Object.assign({}, {
  CTRL_C: "\x03",
  ESCAPE: "\x1b",
  ENTER: "\r",
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  BACKSPACE: "\x7f",
} as const);

const isExitKey = (key: string): boolean => {
  const isCtrlC = key === KEYS.CTRL_C;
  const isEscape = key === KEYS.ESCAPE;
  const isQ = key === "q";
  return isCtrlC || isEscape || isQ;
};

const isEnterKey = (key: string): boolean => key === KEYS.ENTER;

const isUpKey = (key: string): boolean => key === KEYS.UP;

const isDownKey = (key: string): boolean => key === KEYS.DOWN;

const isBackspaceKey = (key: string): boolean => key === KEYS.BACKSPACE;

const isPrintableKey = (key: string): boolean => {
  const isGreaterThanSpace = key >= " ";
  const isLessThanTilde = key <= "~";
  return isGreaterThanSpace && isLessThanTilde;
};

const handleEnter = async (state: State): Promise<State | null> => {
  const selected = getSelectedScript(state);
  const hasSelection = selected !== null;

  if (hasSelection) {
    await executeScript(selected);
  }

  return null;
};

const handleBackspace = (state: State): State => {
  const currentQuery = state.query;
  const newQuery = currentQuery.slice(0, -1);
  return updateQuery(state, newQuery);
};

const handlePrintable = (state: State, key: string): State => {
  const currentQuery = state.query;
  const newQuery = currentQuery.concat(key);
  return updateQuery(state, newQuery);
};

export const handleInput = async (
  state: State,
  data: Buffer,
): Promise<State | null> => {
  const key = data.toString();

  const shouldExit = isExitKey(key);
  if (shouldExit) return null;

  const shouldExecute = isEnterKey(key);
  if (shouldExecute) return handleEnter(state);

  const shouldMoveUp = isUpKey(key);
  if (shouldMoveUp) return updateSelection(state, -1);

  const shouldMoveDown = isDownKey(key);
  if (shouldMoveDown) return updateSelection(state, 1);

  const shouldDelete = isBackspaceKey(key);
  if (shouldDelete) return handleBackspace(state);

  const shouldAddChar = isPrintableKey(key);
  if (shouldAddChar) return handlePrintable(state, key);

  return state;
};
