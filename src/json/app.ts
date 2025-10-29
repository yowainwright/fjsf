import { stdin, stdout, exit } from "process";
import { fuzzySearch } from "../fuzzy.ts";
import { renderJsonUI } from "./renderer.ts";
import { discoverAllPackageJsons, discoverJsonEntries } from "./discover.ts";
import {
  clearScreen,
  hideCursor,
  showCursor,
  enableRawMode,
  disableRawMode,
  colors,
  colorize,
} from "../terminal.ts";
import type { JsonEntry } from "./entry.ts";
import type { FuzzyMatch } from "../fuzzy.ts";
import type { ModeConfig } from "../modes.ts";

interface JsonState {
  query: string;
  selectedIndex: number;
  matches: FuzzyMatch<JsonEntry>[];
  entries: JsonEntry[];
}

const createInitialState = (entries: JsonEntry[]): JsonState => {
  const emptyQuery = "";
  const startIndex = 0;

  const mapper = (item: JsonEntry): FuzzyMatch<JsonEntry> => {
    const match = Object.assign(
      {},
      {
        item,
        score: 0,
        matches: [] as number[],
      },
    );
    return match;
  };
  const initialMatches = entries.map(mapper);

  const state = Object.assign(
    {},
    {
      query: emptyQuery,
      selectedIndex: startIndex,
      matches: initialMatches,
      entries,
    },
  );

  return state;
};

const updateQuery = (state: JsonState, query: string): JsonState => {
  const textExtractor = (entry: JsonEntry): string => {
    const path = entry.path;
    const workspace = entry.workspace;
    const combined = path.concat(" ", workspace);
    return combined;
  };

  const entries = state.entries;
  const matches = fuzzySearch(entries, query, textExtractor);

  const resetIndex = 0;
  const updatedState = Object.assign({}, state, {
    query,
    selectedIndex: resetIndex,
    matches,
  });

  return updatedState;
};

const updateSelection = (state: JsonState, delta: number): JsonState => {
  const matchesLength = state.matches.length;
  const maxIndex = matchesLength - 1;
  const currentIndex = state.selectedIndex;
  const proposedIndex = currentIndex + delta;

  const clampedMin = Math.max(0, proposedIndex);
  const clampedMax = Math.min(maxIndex, clampedMin);
  const newIndex = clampedMax;

  const updatedState = Object.assign({}, state, { selectedIndex: newIndex });
  return updatedState;
};

const handleInput = async (
  state: JsonState,
  data: Buffer,
): Promise<JsonState | null> => {
  const key = data.toString();

  const isCtrlC = key === "\x03";
  const isEscape = key === "\x1b";
  const shouldExit = isCtrlC || isEscape;
  if (shouldExit) return null;

  const isEnter = key === "\r";
  if (isEnter) return null;

  const isUpArrow = key === "\x1b[A";
  const shouldMoveUp = isUpArrow;
  if (shouldMoveUp) return updateSelection(state, -1);

  const isDownArrow = key === "\x1b[B";
  const shouldMoveDown = isDownArrow;
  if (shouldMoveDown) return updateSelection(state, 1);

  const isBackspace = key === "\x7f";
  const shouldDelete = isBackspace;
  if (shouldDelete) {
    const currentQuery = state.query;
    const newQuery = currentQuery.slice(0, -1);
    return updateQuery(state, newQuery);
  }

  const isGreaterThanSpace = key >= " ";
  const isLessThanTilde = key <= "~";
  const isPrintable = isGreaterThanSpace && isLessThanTilde;
  const shouldAddChar = isPrintable;

  if (shouldAddChar) {
    const currentQuery = state.query;
    const newQuery = currentQuery.concat(key);
    return updateQuery(state, newQuery);
  }

  return state;
};

const cleanup = (): void => {
  showCursor();
  disableRawMode();
  clearScreen();
};

const exitApp = (code: number): void => {
  cleanup();
  exit(code);
};

const handleNoEntries = (): void => {
  const message = "No JSON entries found\n";
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
  state: JsonState,
  data: Buffer,
): Promise<JsonState | null> => {
  const newState = await handleInput(state, data);
  const shouldExit = newState === null;

  if (shouldExit) {
    exitApp(0);
  }

  return newState;
};

const runEventLoop = async (
  initialState: JsonState,
  title: string,
): Promise<void> => {
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
      renderJsonUI(state, title);
    }

    result = await stdinIterator.next();
  }
};

export const runJsonApp = async (
  config: ModeConfig,
  title: string,
): Promise<void> => {
  const isCustomMode = config.mode === "custom";
  const customPaths = config.customPaths;
  const hasCustomPaths = customPaths !== undefined;
  const customPathsLength = hasCustomPaths ? customPaths.length : 0;
  const hasCustomPathsWithLength = customPathsLength > 0;
  const shouldUseCustomPaths =
    isCustomMode && hasCustomPaths && hasCustomPathsWithLength;

  const entries = shouldUseCustomPaths
    ? discoverJsonEntries(customPaths)
    : discoverAllPackageJsons();

  const hasNoEntries = entries.length === 0;
  if (hasNoEntries) {
    handleNoEntries();
  }

  const initialState = createInitialState(entries);

  enableRawMode();
  hideCursor();
  renderJsonUI(initialState, title);

  try {
    await runEventLoop(initialState, title);
  } catch (error) {
    handleError(error as Error);
  }
};
