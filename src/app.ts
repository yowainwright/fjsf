import { stdin, stdout, exit } from 'process';
import { discoverScripts } from './discover.ts';
import { createInitialState } from './state.ts';
import { render } from './renderer.ts';
import { handleInput } from './input.ts';
import {
  clearScreen,
  hideCursor,
  showCursor,
  enableRawMode,
  disableRawMode,
  colors,
  colorize,
} from './terminal.ts';
import type { State } from './state.ts';

const cleanup = (): void => {
  showCursor();
  disableRawMode();
  clearScreen();
};

const exitApp = (code: number): void => {
  cleanup();
  exit(code);
};

const handleNoScripts = (): void => {
  stdout.write(colorize('No scripts found in this repository\n', colors.yellow));
  exit(1);
};

const handleError = (error: Error): void => {
  cleanup();
  stdout.write(colorize('Error: ', colors.yellow) + error.message + '\n');
  exit(1);
};

const processInput = async (state: State, data: Buffer): Promise<State | null> => {
  const newState = await handleInput(state, data);

  if (newState === null) {
    exitApp(0);
  }

  return newState;
};

const runEventLoop = async (initialState: State): Promise<void> => {
  let state = initialState;

  for await (const data of stdin) {
    const newState = await processInput(state, data);
    if (newState) {
      state = newState;
      render(state);
    }
  }
};

export const run = async (): Promise<void> => {
  const scripts = discoverScripts();

  if (scripts.length === 0) {
    handleNoScripts();
  }

  const initialState = createInitialState(scripts);

  enableRawMode();
  hideCursor();
  render(initialState);

  try {
    await runEventLoop(initialState);
  } catch (error) {
    handleError(error as Error);
  }
};
