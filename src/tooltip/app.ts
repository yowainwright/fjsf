import { stdin, stdout, exit } from "process";
import { discoverScripts } from "../discover.ts";
import { createInitialState } from "../state.ts";
import { updateQuery } from "../search.ts";
import { updateSelection, getSelectedScript } from "../state.ts";
import { hideCursor, showCursor, enableRawMode, disableRawMode } from "../terminal.ts";
import { renderTooltip, clearTooltipFinal } from "./renderer.ts";
import type { State } from "../state.ts";

const KEYS = {
  CTRL_C: "\x03",
  ESCAPE: "\x1b",
  ENTER: "\r",
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  BACKSPACE: "\x7f",
} as const;

const cleanup = (): void => {
  clearTooltipFinal();
  showCursor();
  disableRawMode();
};

const exitApp = (scriptName?: string): void => {
  cleanup();
  if (scriptName) {
    stdout.write(scriptName);
  }
  exit(0);
};

const isExitKey = (key: string): boolean => {
  return key === KEYS.CTRL_C || key === KEYS.ESCAPE || key === "q";
};

const processInput = async (state: State, data: Buffer): Promise<State | null> => {
  const key = data.toString();

  if (isExitKey(key)) {
    return null;
  }

  if (key === KEYS.ENTER) {
    const selected = getSelectedScript(state);
    if (selected) {
      exitApp(selected.name);
    }
    return null;
  }

  if (key === KEYS.UP) {
    return updateSelection(state, -1);
  }

  if (key === KEYS.DOWN) {
    return updateSelection(state, 1);
  }

  if (key === KEYS.BACKSPACE) {
    const currentQuery = state.query;
    const newQuery = currentQuery.slice(0, -1);
    return updateQuery(state, newQuery);
  }

  if (key >= " " && key <= "~") {
    const currentQuery = state.query;
    const newQuery = currentQuery.concat(key);
    return updateQuery(state, newQuery);
  }

  return state;
};

const runEventLoop = async (initialState: State): Promise<void> => {
  let state = initialState;
  const stdinIterator = stdin[Symbol.asyncIterator]();
  let result = await stdinIterator.next();

  while (!result.done) {
    const data = result.value;
    const newState = await processInput(state, data);

    if (newState === null) {
      exitApp();
      return;
    }

    state = newState;
    renderTooltip(state);

    result = await stdinIterator.next();
  }
};

export const runWidget = async (initialQuery: string): Promise<void> => {
  const scripts = discoverScripts();

  if (scripts.length === 0) {
    exitApp();
  }

  let state = createInitialState(scripts);

  if (initialQuery) {
    state = updateQuery(state, initialQuery);
  }

  enableRawMode();
  hideCursor();
  renderTooltip(state);

  try {
    await runEventLoop(state);
  } catch (error) {
    cleanup();
    exitApp();
  }
};
