// @ts-nocheck
import * as std from "std";
import * as os from "os";
import { fuzzySearch } from "./fuzzy";
import { VERSION, HELP_TEXT } from "./constants";
import { KEY_CODES, COLORS, TERMINAL, MAX_VISIBLE } from "./key-codes";
import type { ParsedOptions, JsonEntry, FuzzyMatch, InteractiveState } from "./types";
import {
  relative,
  toAbsolutePath,
  fileExists,
  readFile,
  findFilesByName,
  findConfigFiles,
  detectFileFormat,
  parseConfigFile,
  ttyWrite,
  spawnCommand,
  getCwd,
} from "./utils";

const { CYAN, GREEN, YELLOW, GRAY, DIM, BOLD, RESET } = COLORS;
const { HIDE_CURSOR, SHOW_CURSOR, CLEAR_SCREEN } = TERMINAL;

const SCRIPT_KEYS = ["scripts", "tasks", "jobs"];

export function extractScripts(
  obj: Record<string, unknown>,
  filePath: string,
  workspace: string,
): JsonEntry[] {
  const fromCurrentLevel = SCRIPT_KEYS.filter(
    (key) => key in obj && obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key]),
  ).flatMap((key) => {
    const section = obj[key] as Record<string, unknown>;
    return Object.entries(section)
      .filter(([, value]) => typeof value === "string")
      .map(([name, value]) => ({
        path: name,
        value: value as string,
        key: name,
        filePath,
        workspace,
      }));
  });

  const fromNested = Object.entries(obj)
    .filter(
      ([key, value]) =>
        !SCRIPT_KEYS.includes(key) && value && typeof value === "object" && !Array.isArray(value),
    )
    .flatMap(([, value]) => extractScripts(value as Record<string, unknown>, filePath, workspace));

  return [...fromCurrentLevel, ...fromNested];
}

export function createEntry(
  path: string,
  value: string,
  key: string,
  filePath: string,
  workspace: string,
): JsonEntry {
  return { path, value, key, filePath, workspace };
}

export function flattenValue(
  value: unknown,
  path: string,
  key: string,
  filePath: string,
  workspace: string,
): JsonEntry[] {
  if (value === null) {
    return [createEntry(path, "null", key, filePath, workspace)];
  }

  if (Array.isArray(value)) {
    const selfEntry = createEntry(path, `Array(${value.length})`, key, filePath, workspace);
    const childEntries = value.flatMap((item: unknown, i: number) =>
      flattenValue(item, `${path}[${i}]`, `[${i}]`, filePath, workspace),
    );
    return [selfEntry, ...childEntries];
  }

  const isObject = typeof value === "object";
  if (isObject) {
    const keys = Object.keys(value as Record<string, unknown>);
    const selfEntry = createEntry(path, `Object(${keys.length})`, key, filePath, workspace);
    const childEntries = keys.flatMap((k: string) => {
      const newPath = path ? `${path}.${k}` : k;
      return flattenValue((value as Record<string, unknown>)[k], newPath, k, filePath, workspace);
    });
    return [selfEntry, ...childEntries];
  }

  return [createEntry(path, String(value), key, filePath, workspace)];
}

export function flattenJson(
  obj: Record<string, unknown>,
  filePath: string,
  workspace: string,
): JsonEntry[] {
  return Object.keys(obj).flatMap((k: string) => flattenValue(obj[k], k, k, filePath, workspace));
}

function parseConfigFileAt(
  filePath: string,
  cwd: string,
): {
  obj: Record<string, unknown>;
  relativePath: string;
  workspace: string;
} | null {
  if (!fileExists(filePath)) return null;

  const content = readFile(filePath);
  if (!content) return null;

  const format = detectFileFormat(filePath);
  const obj = parseConfigFile(content, format);
  if (!obj) return null;

  const relativePath = relative(cwd, filePath);
  const workspace =
    (obj.name as string) ||
    ((obj.package as Record<string, unknown>)?.name as string) ||
    relativePath;

  return { obj, relativePath, workspace };
}

function discoverScriptEntries(filePaths: string[], cwd: string): JsonEntry[] {
  return filePaths
    .map((fp: string) => parseConfigFileAt(fp, cwd))
    .filter(
      (
        r,
      ): r is {
        obj: Record<string, unknown>;
        relativePath: string;
        workspace: string;
      } => r !== null,
    )
    .flatMap(({ obj, relativePath, workspace }) => extractScripts(obj, relativePath, workspace));
}

function discoverAllEntries(filePaths: string[], cwd: string): JsonEntry[] {
  return filePaths
    .map((fp: string) => parseConfigFileAt(fp, cwd))
    .filter(
      (
        r,
      ): r is {
        obj: Record<string, unknown>;
        relativePath: string;
        workspace: string;
      } => r !== null,
    )
    .flatMap(({ obj, relativePath, workspace }) => flattenJson(obj, relativePath, workspace));
}

export function getSelectionPrefix(index: number, selectedIndex: number): string {
  const isSelected = index === selectedIndex;
  return isSelected ? `${GREEN}>${RESET}` : " ";
}

export function formatJsonLine(
  match: FuzzyMatch<JsonEntry>,
  index: number,
  selectedIndex: number,
): string[] {
  const entry = match.item;
  const prefix = getSelectionPrefix(index, selectedIndex);
  const pathLine = `${prefix} ${entry.path} ${DIM}[${entry.workspace}]${RESET}`;
  const valueLine = `  ${GRAY}${entry.value}${RESET}`;
  return [pathLine, valueLine];
}

export function buildRemainingLines(matches: FuzzyMatch<JsonEntry>[]): string[] {
  const remaining = matches.length - MAX_VISIBLE;
  const hasMore = remaining > 0;
  return hasMore ? [`${DIM}`, `... ${remaining} more${RESET}`] : [];
}

export function renderJson(state: InteractiveState<JsonEntry>, title: string): void {
  const scrollOffset = Math.max(
    0,
    Math.min(
      state.selectedIndex - Math.floor(MAX_VISIBLE / 2),
      Math.max(0, state.matches.length - MAX_VISIBLE),
    ),
  );
  const visibleMatches = state.matches.slice(scrollOffset, scrollOffset + MAX_VISIBLE);

  const headerLines = [`${BOLD}${CYAN}${title}${RESET}`, "", `Search: ${state.query}`, ""];

  const itemLines = visibleMatches.flatMap((match: FuzzyMatch<JsonEntry>, i: number) =>
    formatJsonLine(match, scrollOffset + i, state.selectedIndex),
  );

  const remainingLines = buildRemainingLines(state.matches);
  const allLines = [...headerLines, ...itemLines, ...remainingLines];

  std.out.puts(CLEAR_SCREEN + allLines.join("\n") + "\n");
  std.out.flush();
}

export function updateState(
  state: InteractiveState<JsonEntry>,
  query: string,
  items: JsonEntry[],
): InteractiveState<JsonEntry> {
  const getText = (e: JsonEntry): string => `${e.path} ${e.workspace}`;
  const matches = fuzzySearch(items, query, getText);
  const clampedIndex = Math.min(state.selectedIndex, Math.max(0, matches.length - 1));
  return { query, selectedIndex: clampedIndex, matches, items };
}

export function exitWithError(message: string): never {
  std.err.puts(`${YELLOW}Error: ${message}${RESET}\n`);
  std.exit(1);
}

export function readKeyInput(): Uint8Array | null {
  const buf = new Uint8Array(16);
  const n = os.read(std.in.fileno(), buf.buffer, 0, buf.length);
  const hasData = n > 0;
  return hasData ? buf.slice(0, n) : null;
}

export function isHardExit(byte0: number, key: Uint8Array): boolean {
  const isCtrlC = byte0 === KEY_CODES.CTRL_C;
  const isEscape = byte0 === KEY_CODES.ESCAPE && key.length === 1;
  return isCtrlC || isEscape;
}

export function isEnterKey(byte0: number): boolean {
  return byte0 === KEY_CODES.ENTER_CR || byte0 === KEY_CODES.ENTER_LF;
}

export function isArrowSequence(byte0: number, key: Uint8Array): boolean {
  const isEscape = byte0 === KEY_CODES.ESCAPE;
  const hasEnoughBytes = key.length >= 3;
  const isNormalMode = key[1] === KEY_CODES.BRACKET;
  const isAppMode = key[1] === KEY_CODES.BRACKET_APP;
  return isEscape && hasEnoughBytes && (isNormalMode || isAppMode);
}

export function isBackspaceKey(byte0: number): boolean {
  return byte0 === KEY_CODES.DELETE || byte0 === KEY_CODES.BACKSPACE;
}

export function isPrintableChar(byte0: number): boolean {
  return byte0 >= KEY_CODES.PRINTABLE_START && byte0 < KEY_CODES.PRINTABLE_END;
}

export function createInitialState(items: JsonEntry[]): InteractiveState<JsonEntry> {
  const getText = (e: JsonEntry): string => `${e.path} ${e.workspace}`;
  return {
    query: "",
    selectedIndex: 0,
    matches: fuzzySearch(items, "", getText),
    items,
  };
}

export function cleanupTerminal(): void {
  std.out.puts(SHOW_CURSOR);
  std.out.puts(CLEAR_SCREEN);
  os.ttySetRaw(std.in.fileno(), false);
}

export function handleArrowKey(
  state: InteractiveState<JsonEntry>,
  key: Uint8Array,
  render: (state: InteractiveState<JsonEntry>, title: string) => void,
  title: string,
): InteractiveState<JsonEntry> {
  const isUpArrow = key[2] === KEY_CODES.ARROW_UP;
  const isDownArrow = key[2] === KEY_CODES.ARROW_DOWN;

  if (isUpArrow) {
    const newState = { ...state, selectedIndex: Math.max(0, state.selectedIndex - 1) };
    render(newState, title);
    return newState;
  }

  if (isDownArrow) {
    const newState = {
      ...state,
      selectedIndex: Math.min(state.matches.length - 1, state.selectedIndex + 1),
    };
    render(newState, title);
    return newState;
  }

  return state;
}

export function handleBackspace(
  state: InteractiveState<JsonEntry>,
  items: JsonEntry[],
  render: (state: InteractiveState<JsonEntry>, title: string) => void,
  title: string,
): InteractiveState<JsonEntry> {
  const hasQuery = state.query.length > 0;
  if (!hasQuery) return state;

  const newQuery = state.query.slice(0, -1);
  const newState = updateState(state, newQuery, items);
  render(newState, title);
  return newState;
}

export function handlePrintableChar(
  state: InteractiveState<JsonEntry>,
  byte0: number,
  items: JsonEntry[],
  render: (state: InteractiveState<JsonEntry>, title: string) => void,
  title: string,
): InteractiveState<JsonEntry> {
  const char = String.fromCharCode(byte0);
  const newQuery = state.query + char;
  const newState = updateState(state, newQuery, items);
  render(newState, title);
  return newState;
}

export function runInteractive(
  items: JsonEntry[],
  render: (state: InteractiveState<JsonEntry>, title: string) => void,
  title: string,
): FuzzyMatch<JsonEntry> | null {
  const hasNoItems = items.length === 0;
  if (hasNoItems) {
    std.err.puts(`${YELLOW}No entries found${RESET}\n`);
    std.exit(1);
  }

  os.ttySetRaw(std.in.fileno());
  std.out.puts(HIDE_CURSOR);

  let state = createInitialState(items);
  render(state, title);

  while (true) {
    const key = readKeyInput();
    if (!key) continue;

    const byte0 = key[0];

    if (isHardExit(byte0, key)) {
      cleanupTerminal();
      return null;
    }

    const isQuitKey = byte0 === KEY_CODES.Q && state.query.length === 0;
    if (isQuitKey) {
      cleanupTerminal();
      return null;
    }

    if (isEnterKey(byte0)) {
      cleanupTerminal();
      return state.matches[state.selectedIndex] ?? null;
    }

    if (isArrowSequence(byte0, key)) {
      state = handleArrowKey(state, key, render, title);
      continue;
    }

    if (isBackspaceKey(byte0)) {
      state = handleBackspace(state, items, render, title);
      continue;
    }

    if (isPrintableChar(byte0)) {
      state = handlePrintableChar(state, byte0, items, render, title);
    }
  }
}

export function isHelpArg(arg: string): boolean {
  return ["help", "h", "--help", "-h"].includes(arg);
}

export function isVersionArg(arg: string): boolean {
  return ["--version", "-v"].includes(arg);
}

export function isQuitArg(arg: string): boolean {
  return ["quit", "q"].includes(arg);
}

export function isFindArg(arg: string): boolean {
  return ["find", "f"].includes(arg);
}

export function isPathArg(arg: string): boolean {
  return ["path", "p"].includes(arg);
}

export function hasNextArg(args: string[], i: number): boolean {
  return i + 1 < args.length;
}

export function getNextArg(args: string[], i: number): string | undefined {
  return hasNextArg(args, i) ? args[i + 1] : undefined;
}

export function createDefaultOptions(): ParsedOptions {
  return {
    help: false,
    version: false,
    quit: false,
    mode: "default",
    filePath: undefined,
  };
}

export function parseArgs(args: string[]): ParsedOptions {
  const options = createDefaultOptions();
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    const nextArg = getNextArg(args, i);

    if (isHelpArg(arg)) {
      options.help = true;
    } else if (isVersionArg(arg)) {
      options.version = true;
    } else if (isQuitArg(arg)) {
      options.quit = true;
    } else if (isFindArg(arg)) {
      options.mode = "find";
      if (nextArg) {
        options.filePath = nextArg;
        i++;
      }
    } else if (isPathArg(arg)) {
      options.mode = "path";
      if (nextArg) {
        options.filePath = nextArg;
        i++;
      }
    } else if (!arg.startsWith("-")) {
      options.filePath = arg;
    }

    i++;
  }

  return options;
}

function executeEntry(entry: JsonEntry): void {
  const ttyFd = os.open("/dev/tty", os.O_WRONLY);
  if (ttyFd >= 0) {
    ttyWrite(ttyFd, SHOW_CURSOR);
    ttyWrite(ttyFd, CLEAR_SCREEN);
    ttyWrite(ttyFd, `${CYAN}Running: ${entry.value}${RESET}\n\n`);
    os.close(ttyFd);
  }
  spawnCommand([entry.value]);
}

export function main(): void {
  const args = scriptArgs.slice(1);
  const options = parseArgs(args);

  if (options.help) {
    print(HELP_TEXT);
    return;
  }

  if (options.version) {
    print(VERSION);
    return;
  }

  if (options.quit) {
    return;
  }

  const cwd = getCwd();

  if (options.mode === "find") {
    const fileName = options.filePath || "package.json";
    const paths = findFilesByName(cwd, fileName, 0, 5);
    const entries = discoverScriptEntries(paths, cwd);
    const selected = runInteractive(entries, renderJson, `Find: ${fileName}`);
    if (selected) executeEntry(selected.item);
    return;
  }

  if (options.mode === "path") {
    if (!options.filePath) exitWithError("No file path provided");
    const absolutePath = toAbsolutePath(cwd, options.filePath!);
    const entries = discoverAllEntries([absolutePath], cwd);
    const selected = runInteractive(entries, renderJson, `Path: ${options.filePath}`);
    if (selected) executeEntry(selected.item);
    return;
  }

  if (options.filePath) {
    const absolutePath = toAbsolutePath(cwd, options.filePath);
    const entries = discoverScriptEntries([absolutePath], cwd);
    const selected = runInteractive(entries, renderJson, `Scripts: ${options.filePath}`);
    if (selected) executeEntry(selected.item);
    return;
  }

  const paths = findConfigFiles(cwd, 0, 5);
  const entries = discoverScriptEntries(paths, cwd);
  const selected = runInteractive(entries, renderJson, "Fuzzy Script Finder");
  if (selected) executeEntry(selected.item);
}

main();
