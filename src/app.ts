import { stdin, stdout, exit } from "process";
import { discoverScripts } from "./discover.ts";
import { createInitialState } from "./state.ts";
import { render } from "./renderer.ts";
import { handleInput } from "./input.ts";
import {
  clearScreen,
  hideCursor,
  showCursor,
  enableRawMode,
  disableRawMode,
  colors,
  colorize,
} from "./terminal.ts";
import type { State } from "./state.ts";
import type { ModeConfig } from "./modes.ts";

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
  const message = "No scripts found in this repository\n";
  const coloredMessage = colorize(message, colors.yellow);
  stdout.write(coloredMessage);
  exit(1);
};

const handleError = (error: Error): void => {
  cleanup();
  const errorPrefix = colorize("Error: ", colors.yellow);
  const errorMessage = error.message;
  const newline = "\n";
  const fullMessage = errorPrefix.concat(errorMessage, newline);
  stdout.write(fullMessage);
  exit(1);
};

const processInput = async (
  state: State,
  data: Buffer,
): Promise<State | null> => {
  const newState = await handleInput(state, data);

  const shouldExit = newState === null;
  if (shouldExit) {
    exitApp(0);
  }

  return newState;
};

const runEventLoop = async (initialState: State): Promise<void> => {
  let state = initialState;

  const stdinIterator = stdin[Symbol.asyncIterator]();
  let result = await stdinIterator.next();

  const shouldContinue = (): boolean => !result.done;

  while (shouldContinue()) {
    const data = result.value;
    const newState = await processInput(state, data);
    const hasNewState = newState !== null;

    if (hasNewState) {
      state = newState;
      render(state);
    }

    result = await stdinIterator.next();
  }
};

export const run = async (config?: ModeConfig): Promise<void> => {
  const filePath = config?.filePath;
  const scripts = discoverScripts(filePath);

  const hasNoScripts = scripts.length === 0;
  if (hasNoScripts) {
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
