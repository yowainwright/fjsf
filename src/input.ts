import { updateSelection, getSelectedScript } from './state.ts';
import { updateQuery } from './search.ts';
import { executeScript } from './executor.ts';
import type { State } from './state.ts';

const KEYS = {
  CTRL_C: '\x03',
  ESCAPE: '\x1b',
  ENTER: '\r',
  UP: '\x1b[A',
  DOWN: '\x1b[B',
  BACKSPACE: '\x7f',
} as const;

const isExitKey = (key: string): boolean => key === KEYS.CTRL_C || key === KEYS.ESCAPE;

const isEnterKey = (key: string): boolean => key === KEYS.ENTER;

const isUpKey = (key: string): boolean => key === KEYS.UP;

const isDownKey = (key: string): boolean => key === KEYS.DOWN;

const isBackspaceKey = (key: string): boolean => key === KEYS.BACKSPACE;

const isPrintableKey = (key: string): boolean => key >= ' ' && key <= '~';

const handleEnter = async (state: State): Promise<State | null> => {
  const selected = getSelectedScript(state);
  if (selected) {
    await executeScript(selected);
  }
  return null;
};

const handleBackspace = (state: State): State => updateQuery(state, state.query.slice(0, -1));

const handlePrintable = (state: State, key: string): State => updateQuery(state, state.query + key);

export const handleInput = async (state: State, data: Buffer): Promise<State | null> => {
  const key = data.toString();

  if (isExitKey(key)) return null;
  if (isEnterKey(key)) return handleEnter(state);
  if (isUpKey(key)) return updateSelection(state, -1);
  if (isDownKey(key)) return updateSelection(state, 1);
  if (isBackspaceKey(key)) return handleBackspace(state);
  if (isPrintableKey(key)) return handlePrintable(state, key);

  return state;
};
