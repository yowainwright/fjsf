// @ts-nocheck
import * as std from "std";
import * as os from "os";
import { fuzzySearch, getScriptText } from "./core";
import { VERSION, HELP_TEXT } from "./constants";
import { SHELL_SCRIPTS } from "./shell-scripts";
import { KEY_CODES, COLORS, TERMINAL, MAX_VISIBLE } from "./key-codes";
import type {
  PackageScript,
  ParsedOptions,
  JsonEntry,
  FuzzyMatch,
  InteractiveState,
  WidgetContext,
  PackageManager,
} from "./types";
import {
  join,
  dirname,
  relative,
  toAbsolutePath,
  fileExists,
  readFile,
  writeFile,
  appendFile,
  parseJson,
  getNestedValue,
  findPackageJsonFiles,
  findFilesByName,
  expandWorkspaces,
  getHomeDir,
  detectShell,
  getShellConfigFile,
  ttyWrite,
  spawnCommand,
  getCwd,
  changeDir,
  makeDir,
} from "./utils";

const { CYAN, GREEN, YELLOW, GRAY, DIM, BOLD, RESET } = COLORS;
const { HIDE_CURSOR, SHOW_CURSOR, CLEAR_SCREEN, CLEAR_LINE, MOVE_UP } =
  TERMINAL;

export function getWorkspacePatterns(
  packageJson: Record<string, unknown>,
): string[] {
  const workspaces = packageJson.workspaces;
  if (Array.isArray(workspaces)) return workspaces as string[];
  if (workspaces && (workspaces as Record<string, unknown>).packages)
    return (workspaces as Record<string, unknown>).packages as string[];
  return [];
}

export function extractScriptsFromPackage(
  cwd: string,
  packagePath: string,
): PackageScript[] {
  const content = readFile(packagePath);
  if (!content) return [];

  const pkg = parseJson<Record<string, unknown>>(content);
  const hasScripts = pkg && pkg.scripts;
  if (!hasScripts) return [];

  const dir = packagePath.replace(/\/package\.json$/, "");
  const workspace = (pkg.name as string) || relative(cwd, dir);
  const relativePath = relative(cwd, packagePath);

  return Object.entries(pkg.scripts as Record<string, string>).map(
    ([name, command]) => ({
      name,
      command,
      workspace,
      packagePath: relativePath,
    }),
  );
}

export function discoverScriptsFromFile(
  cwd: string,
  filePath: string,
): PackageScript[] {
  const absolutePath = toAbsolutePath(cwd, filePath);
  if (!fileExists(absolutePath)) return [];
  return extractScriptsFromPackage(cwd, absolutePath);
}

export function discoverScriptsFromAllPackages(
  cwd: string,
  rootPkgPath: string,
  rootScripts: PackageScript[],
): PackageScript[] {
  const nestedScripts = findPackageJsonFiles(cwd, 0, 5)
    .filter((pkgPath: string) => pkgPath !== rootPkgPath)
    .flatMap((pkgPath: string) => extractScriptsFromPackage(cwd, pkgPath));

  return [...rootScripts, ...nestedScripts];
}

export function discoverScriptsFromWorkspaces(
  cwd: string,
  patterns: string[],
  rootScripts: PackageScript[],
): PackageScript[] {
  const workspaceScripts = expandWorkspaces(cwd, patterns)
    .map((dir: string) => join(dir, "package.json"))
    .flatMap((pkgPath: string) => extractScriptsFromPackage(cwd, pkgPath));

  return [...rootScripts, ...workspaceScripts];
}

export function discoverScripts(cwdOrFilePath?: string): PackageScript[] {
  const cwd = getCwd();

  const isSpecificFile = cwdOrFilePath && cwdOrFilePath.endsWith(".json");
  if (isSpecificFile) {
    return discoverScriptsFromFile(cwd, cwdOrFilePath);
  }

  const rootPkgPath = join(cwd, "package.json");
  if (!fileExists(rootPkgPath)) return [];

  const content = readFile(rootPkgPath);
  const pkg = parseJson<Record<string, unknown>>(content || "");
  if (!pkg) return [];

  const rootScripts = extractScriptsFromPackage(cwd, rootPkgPath);
  const patterns = getWorkspacePatterns(pkg);

  const hasNoWorkspaces = patterns.length === 0;
  if (hasNoWorkspaces) {
    return discoverScriptsFromAllPackages(cwd, rootPkgPath, rootScripts);
  }

  return discoverScriptsFromWorkspaces(cwd, patterns, rootScripts);
}

export function detectPackageManager(cwd: string): PackageManager {
  if (fileExists(join(cwd, "bun.lockb")) || fileExists(join(cwd, "bun.lock")))
    return "bun";
  if (fileExists(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fileExists(join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

export function buildRunCommand(
  script: PackageScript,
  pm: PackageManager,
): string[] {
  const isRootPackage = script.packagePath === "package.json";

  if (pm === "pnpm") {
    return isRootPackage
      ? ["pnpm", "run", script.name]
      : ["pnpm", "--filter", script.workspace, "run", script.name];
  }

  if (pm === "yarn") {
    return isRootPackage
      ? ["yarn", "run", script.name]
      : ["yarn", "workspace", script.workspace, "run", script.name];
  }

  if (pm === "bun") {
    return isRootPackage
      ? ["bun", "run", script.name]
      : ["bun", "--filter", script.workspace, "run", script.name];
  }

  return isRootPackage
    ? ["npm", "run", script.name]
    : ["npm", "run", script.name, "--workspace=" + script.workspace];
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
    const selfEntry = createEntry(
      path,
      `Array(${value.length})`,
      key,
      filePath,
      workspace,
    );
    const childEntries = value.flatMap((item: unknown, i: number) =>
      flattenValue(item, `${path}[${i}]`, `[${i}]`, filePath, workspace),
    );
    return [selfEntry, ...childEntries];
  }

  const isObject = typeof value === "object";
  if (isObject) {
    const keys = Object.keys(value as Record<string, unknown>);
    const selfEntry = createEntry(
      path,
      `Object(${keys.length})`,
      key,
      filePath,
      workspace,
    );
    const childEntries = keys.flatMap((k: string) => {
      const newPath = path ? `${path}.${k}` : k;
      return flattenValue(
        (value as Record<string, unknown>)[k],
        newPath,
        k,
        filePath,
        workspace,
      );
    });
    return [selfEntry, ...childEntries];
  }

  return [createEntry(path, String(value), key, filePath, workspace)];
}

export function flattenJson(
  obj: Record<string, unknown>,
  prefix: string,
  filePath: string,
  workspace: string,
): JsonEntry[] {
  return Object.keys(obj).flatMap((k: string) =>
    flattenValue(obj[k], k, k, filePath, workspace),
  );
}

export function parseJsonFile(
  filePath: string,
  cwd: string,
): {
  json: Record<string, unknown>;
  relativePath: string;
  workspace: string;
} | null {
  if (!fileExists(filePath)) return null;

  const content = readFile(filePath);
  const json = parseJson<Record<string, unknown>>(content || "");
  if (!json) return null;

  const relativePath = relative(cwd, filePath);
  const workspace = (json.name as string) || relativePath;

  return { json, relativePath, workspace };
}

export function discoverJsonEntries(
  filePaths: string[],
  cwd: string,
): JsonEntry[] {
  return filePaths
    .map((filePath: string) => parseJsonFile(filePath, cwd))
    .filter(
      (
        result,
      ): result is {
        json: Record<string, unknown>;
        relativePath: string;
        workspace: string;
      } => result !== null,
    )
    .flatMap(({ json, relativePath, workspace }) =>
      flattenJson(json, "", relativePath, workspace),
    );
}

export function discoverAllPackageJsons(cwd: string): JsonEntry[] {
  const paths = findPackageJsonFiles(cwd, 0, 5);
  return discoverJsonEntries(paths, cwd);
}

export function discoverFilesByNameEntries(
  fileName: string,
  cwd: string,
): JsonEntry[] {
  const paths = findFilesByName(cwd, fileName, 0, 5);
  return discoverJsonEntries(paths, cwd);
}

export function getSelectionPrefix(
  index: number,
  selectedIndex: number,
): string {
  const isSelected = index === selectedIndex;
  return isSelected ? `${GREEN}>${RESET}` : " ";
}

export function formatScriptLine(
  match: FuzzyMatch<PackageScript>,
  index: number,
  selectedIndex: number,
): string[] {
  const script = match.item;
  const prefix = getSelectionPrefix(index, selectedIndex);
  const nameLine = `${prefix} ${script.name} ${DIM}[${script.workspace}]${RESET}`;
  const commandLine = `  ${GRAY}${script.command}${RESET}`;
  return [nameLine, commandLine];
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

export function buildRemainingLines<T>(matches: FuzzyMatch<T>[]): string[] {
  const remaining = matches.length - MAX_VISIBLE;
  const hasMore = remaining > 0;
  return hasMore ? [`${DIM}`, `... ${remaining} more${RESET}`] : [];
}

export function renderList<T>(
  state: InteractiveState<T>,
  title: string,
  formatLine: (
    match: FuzzyMatch<T>,
    index: number,
    selectedIndex: number,
  ) => string[],
): void {
  const visibleMatches = state.matches.slice(0, MAX_VISIBLE);

  const headerLines = [
    `${BOLD}${CYAN}${title}${RESET}`,
    "",
    `Search: ${state.query}`,
    "",
  ];

  const itemLines = visibleMatches.flatMap((match: FuzzyMatch<T>, i: number) =>
    formatLine(match, i, state.selectedIndex),
  );

  const remainingLines = buildRemainingLines(state.matches);
  const allLines = [...headerLines, ...itemLines, ...remainingLines];

  std.out.puts(CLEAR_SCREEN + allLines.join("\n") + "\n");
  std.out.flush();
}

export function renderScripts(state: InteractiveState<PackageScript>): void {
  renderList(state, "Fuzzy NPM Scripts", formatScriptLine);
}

export function renderJson(
  state: InteractiveState<JsonEntry>,
  title: string,
): void {
  renderList(state, title, formatJsonLine);
}

export function updateState<T>(
  state: InteractiveState<T>,
  query: string,
  items: T[],
  getText: (item: T) => string,
): InteractiveState<T> {
  const matches = fuzzySearch(items, query, getText);
  const clampedIndex = Math.min(
    state.selectedIndex,
    Math.max(0, matches.length - 1),
  );
  return { query, selectedIndex: clampedIndex, matches, items };
}

export function matchesQuery(
  script: PackageScript,
  lowerQuery: string,
): boolean {
  if (!lowerQuery) return true;
  const nameMatches = script.name.toLowerCase().includes(lowerQuery);
  const workspaceMatches = script.workspace.toLowerCase().includes(lowerQuery);
  return nameMatches || workspaceMatches;
}

export function formatCompletion(script: PackageScript): string {
  return `${script.name}:[${script.workspace}] ${script.command}`;
}

export function runCompletions(query: string, scripts: PackageScript[]): void {
  const lowerQuery = (query || "").toLowerCase();

  scripts
    .filter((s: PackageScript) => matchesQuery(s, lowerQuery))
    .map(formatCompletion)
    .forEach((line: string) => print(line));
}

export function executeScript(script: PackageScript): void {
  const cwd = getCwd();
  const pm = detectPackageManager(cwd);
  const cmd = buildRunCommand(script, pm);

  std.out.puts(SHOW_CURSOR);
  std.out.puts(CLEAR_SCREEN);
  std.out.puts(`${CYAN}Running: ${cmd.join(" ")}${RESET}\n\n`);
  std.out.flush();

  spawnCommand(cmd);
}

export function exitWithError(message: string): never {
  std.err.puts(`${YELLOW}Error: ${message}${RESET}\n`);
  std.exit(1);
}

export function validateRunInputs(
  filePath: string | undefined,
  runKey: string | undefined,
): void {
  if (!filePath) exitWithError("No file path provided");
  if (!runKey) exitWithError("No key provided");
}

export function loadAndParseJson(
  absolutePath: string,
  filePath: string,
): Record<string, unknown> {
  const content = readFile(absolutePath);
  if (!content) exitWithError(`Could not read ${filePath}`);

  const json = parseJson<Record<string, unknown>>(content);
  if (!json) exitWithError(`Invalid JSON in ${filePath}`);

  return json;
}

export function validateRunKey(
  value: unknown,
  runKey: string,
  filePath: string,
): void {
  const isUndefined = value === undefined;
  if (isUndefined) exitWithError(`Key "${runKey}" not found in ${filePath}`);

  const isNotString = typeof value !== "string";
  if (isNotString)
    exitWithError(`Cannot run "${runKey}" - value is not a string`);

  const isNotScript = !runKey.startsWith("scripts.");
  if (isNotScript)
    exitWithError(
      `Cannot run "${runKey}" - not a script (must start with "scripts.")`,
    );
}

export function buildSimpleRunCommand(
  pm: PackageManager,
  scriptName: string,
): string[] {
  const commands: Record<PackageManager, string[]> = {
    pnpm: ["pnpm", "run", scriptName],
    yarn: ["yarn", "run", scriptName],
    bun: ["bun", "run", scriptName],
    npm: ["npm", "run", scriptName],
  };
  return commands[pm] || commands.npm;
}

export function runKey(
  filePath: string | undefined,
  runKeyValue: string | undefined,
): void {
  validateRunInputs(filePath, runKeyValue);

  const cwd = getCwd();
  const absolutePath = toAbsolutePath(cwd, filePath!);
  const json = loadAndParseJson(absolutePath, filePath!);
  const value = getNestedValue(json, runKeyValue!);

  validateRunKey(value, runKeyValue!, filePath!);

  const scriptName = runKeyValue!.substring("scripts.".length);
  const packageDir = dirname(absolutePath);
  const pm = detectPackageManager(packageDir);
  const cmd = buildSimpleRunCommand(pm, scriptName);

  std.out.puts(`${CYAN}Running: ${cmd.join(" ")}${RESET}\n`);
  std.out.puts(`${CYAN}From: ${filePath}${RESET}\n\n`);
  std.out.flush();

  changeDir(packageDir);
  spawnCommand(cmd);
}

export function createDefaultOptions(): ParsedOptions {
  return {
    help: false,
    version: false,
    quit: false,
    completions: false,
    completionsQuery: "",
    widget: false,
    widgetQuery: "",
    mode: "scripts",
    filePath: undefined,
    runKey: undefined,
    initMode: "widget",
  };
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

export function isCompletionsArg(arg: string): boolean {
  return ["completions", "--completions"].includes(arg);
}

export function isFindArg(arg: string): boolean {
  return ["find", "f"].includes(arg);
}

export function isPathArg(arg: string): boolean {
  return ["path", "p"].includes(arg);
}

export function isRunArg(arg: string): boolean {
  return ["run", "r"].includes(arg);
}

export function isWidgetArg(arg: string): boolean {
  return ["--widget", "-w"].includes(arg);
}

export function hasNextArg(args: string[], i: number): boolean {
  return i + 1 < args.length;
}

export function getNextArg(args: string[], i: number): string | undefined {
  return hasNextArg(args, i) ? args[i + 1] : undefined;
}

export function parseArgs(args: string[]): ParsedOptions {
  const options = createDefaultOptions();
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    const nextArg = getNextArg(args, i);
    const nextArgIsOption = nextArg && nextArg.startsWith("-");

    if (isHelpArg(arg)) {
      options.help = true;
    } else if (isVersionArg(arg)) {
      options.version = true;
    } else if (isQuitArg(arg)) {
      options.quit = true;
    } else if (isCompletionsArg(arg)) {
      options.completions = true;
      const hasQuery = nextArg && !nextArgIsOption;
      if (hasQuery) {
        options.completionsQuery = nextArg;
        i++;
      }
    } else if (isWidgetArg(arg)) {
      options.widget = true;
      const hasQuery = nextArg && !nextArgIsOption;
      if (hasQuery) {
        options.widgetQuery = nextArg;
        i++;
      }
    } else if (arg === "init") {
      options.mode = "init";
      const hasNativeFlag = nextArg === "--native";
      if (hasNativeFlag) {
        options.initMode = "native";
        i++;
      }
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
    } else if (isRunArg(arg)) {
      options.mode = "run-key";
      if (nextArg) {
        options.filePath = nextArg;
        i++;
      }
      const runKeyArg = getNextArg(args, i);
      if (runKeyArg) {
        options.runKey = runKeyArg;
        i++;
      }
    } else if (arg.endsWith(".json")) {
      options.filePath = arg;
    }

    i++;
  }

  return options;
}

export function readKeyInput(): Uint8Array | null {
  const buf = new Uint8Array(16);
  const n = os.read(std.in.fileno(), buf.buffer, 0, buf.length);
  const hasData = n > 0;
  return hasData ? buf.slice(0, n) : null;
}

export function isExitKey(byte0: number, key: Uint8Array): boolean {
  const isCtrlC = byte0 === KEY_CODES.CTRL_C;
  const isEscape = byte0 === KEY_CODES.ESCAPE && key.length === 1;
  const isQKey = byte0 === KEY_CODES.Q;
  return isCtrlC || isEscape || isQKey;
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

export function createInitialState<T>(
  items: T[],
  getText: (item: T) => string,
): InteractiveState<T> {
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

export function handleArrowKey<T>(
  state: InteractiveState<T>,
  key: Uint8Array,
  render: (state: InteractiveState<T>, title: string) => void,
  title: string,
): InteractiveState<T> {
  const isUpArrow = key[2] === KEY_CODES.ARROW_UP;
  const isDownArrow = key[2] === KEY_CODES.ARROW_DOWN;

  if (isUpArrow) {
    state.selectedIndex = Math.max(0, state.selectedIndex - 1);
    render(state, title);
  } else if (isDownArrow) {
    state.selectedIndex = Math.min(
      state.matches.length - 1,
      state.selectedIndex + 1,
    );
    render(state, title);
  }

  return state;
}

export function handleBackspace<T>(
  state: InteractiveState<T>,
  items: T[],
  getText: (item: T) => string,
  render: (state: InteractiveState<T>, title: string) => void,
  title: string,
): InteractiveState<T> {
  const hasQuery = state.query.length > 0;
  if (!hasQuery) return state;

  const newQuery = state.query.slice(0, -1);
  const newState = updateState(state, newQuery, items, getText);
  render(newState, title);
  return newState;
}

export function handlePrintableChar<T>(
  state: InteractiveState<T>,
  byte0: number,
  items: T[],
  getText: (item: T) => string,
  render: (state: InteractiveState<T>, title: string) => void,
  title: string,
): InteractiveState<T> {
  const char = String.fromCharCode(byte0);
  const newQuery = state.query + char;
  const newState = updateState(state, newQuery, items, getText);
  render(newState, title);
  return newState;
}

export function runInteractive<T>(
  items: T[],
  getText: (item: T) => string,
  render: (state: InteractiveState<T>, title: string) => void,
  title: string,
): FuzzyMatch<T> | null {
  const hasNoItems = items.length === 0;
  if (hasNoItems) {
    std.err.puts(`${YELLOW}No entries found${RESET}\n`);
    std.exit(1);
  }

  os.ttySetRaw(std.in.fileno());
  std.out.puts(HIDE_CURSOR);

  let state = createInitialState(items, getText);
  render(state, title);

  while (true) {
    const key = readKeyInput();
    if (!key) continue;

    const byte0 = key[0];

    if (isExitKey(byte0, key)) {
      cleanupTerminal();
      return null;
    }

    if (isEnterKey(byte0)) {
      cleanupTerminal();
      return state.matches[state.selectedIndex];
    }

    if (isArrowSequence(byte0, key)) {
      state = handleArrowKey(state, key, render, title);
      continue;
    }

    if (isBackspaceKey(byte0)) {
      state = handleBackspace(state, items, getText, render, title);
      continue;
    }

    if (isPrintableChar(byte0)) {
      state = handlePrintableChar(state, byte0, items, getText, render, title);
    }
  }
}

export function runInit(initMode: "widget" | "native"): void {
  print(`\n${BOLD}${CYAN}fjsf shell integration setup${RESET}\n`);

  const shell = detectShell();

  if (shell === "unknown") {
    std.err.puts(
      `${YELLOW}Unable to detect shell type. Supported: bash, zsh, fish${RESET}\n`,
    );
    std.exit(1);
  }

  print(`${DIM}Detected shell: ${shell}${RESET}`);
  print(`${DIM}Completion mode: ${initMode}${RESET}`);

  const configFile = getShellConfigFile(shell);
  if (!configFile) {
    std.err.puts(`${YELLOW}Could not find shell config file${RESET}\n`);
    std.exit(1);
  }

  print(`${DIM}Config file: ${configFile}${RESET}`);

  const home = getHomeDir();
  const fjsfDir = join(home, ".fjsf");

  if (!fileExists(fjsfDir)) {
    makeDir(fjsfDir);
  }

  print(`${DIM}fjsf directory: ${fjsfDir}${RESET}\n`);

  const integrationFile = join(fjsfDir, `init.${shell}`);

  const scripts = SHELL_SCRIPTS[shell as "zsh" | "bash" | "fish"];
  if (!scripts) {
    std.err.puts(`${YELLOW}No shell scripts available for ${shell}${RESET}\n`);
    std.exit(1);
  }

  const scriptType = initMode === "native" ? "native" : "widget";
  const interceptorScript = scripts[scriptType];
  const completionsScript = scripts.completions;

  const content = `${interceptorScript}\n\n${completionsScript}\n\nalias fj='fjsf'\n`;

  if (writeFile(integrationFile, content)) {
    print(`${GREEN}Created ${integrationFile}${RESET}`);
  } else {
    std.err.puts(`${YELLOW}Failed to create ${integrationFile}${RESET}\n`);
    std.exit(1);
  }

  const sourceLine = `[ -f "${integrationFile}" ] && source "${integrationFile}"`;
  const existingContent = readFile(configFile) || "";

  if (existingContent.includes(".fjsf/init.")) {
    print(`${GREEN}Already sourced in ${configFile}${RESET}`);
  } else {
    const entry = `\n# fjsf\n${sourceLine}\n`;
    if (appendFile(configFile, entry)) {
      print(`${GREEN}Added source line to ${configFile}${RESET}`);
    } else {
      std.err.puts(`${YELLOW}Failed to update ${configFile}${RESET}\n`);
    }
  }

  print(`${GREEN}Added 'fj' alias for fjsf${RESET}`);

  print(`\n${BOLD}${GREEN}Setup complete!${RESET}`);
  print(
    `${DIM}Restart your shell or run: ${RESET}${BOLD}source ${configFile}${RESET}\n`,
  );

  if (initMode === "native") {
    print(
      `${CYAN}Using native completions mode (works with fzf-tab)${RESET}\n`,
    );
  }
}

const WIDGET_MAX_VISIBLE = 8;

export function formatWidgetLine(
  match: FuzzyMatch<PackageScript>,
  index: number,
  selectedIndex: number,
): string {
  const script = match.item;
  const isSelected = index === selectedIndex;
  const prefix = isSelected ? `${GREEN}❯${RESET}` : " ";
  return `${prefix} ${script.name} ${DIM}[${script.workspace}]${RESET}`;
}

export function renderWidget(
  ttyFd: number,
  state: InteractiveState<PackageScript>,
  lastLineCount: number,
): number {
  for (let i = 0; i < lastLineCount; i++) {
    ttyWrite(ttyFd, MOVE_UP);
    ttyWrite(ttyFd, CLEAR_LINE);
  }

  const hasNoMatches = state.matches.length === 0;
  if (hasNoMatches) {
    ttyWrite(ttyFd, `\n${DIM}No matches${RESET}`);
    return 1;
  }

  const halfWindow = Math.floor(WIDGET_MAX_VISIBLE / 2);
  const totalMatches = state.matches.length;
  let startIndex = Math.max(0, state.selectedIndex - halfWindow);
  const endIndex = Math.min(totalMatches, startIndex + WIDGET_MAX_VISIBLE);
  const actualVisible = endIndex - startIndex;

  const needsAdjustment =
    actualVisible < WIDGET_MAX_VISIBLE && totalMatches >= WIDGET_MAX_VISIBLE;
  if (needsAdjustment) {
    startIndex = Math.max(0, endIndex - WIDGET_MAX_VISIBLE);
  }

  const visibleMatches = state.matches.slice(startIndex, endIndex);

  for (let idx = 0; idx < visibleMatches.length; idx++) {
    const match = visibleMatches[idx];
    if (!match) continue;
    const absoluteIndex = startIndex + idx;
    const line = formatWidgetLine(match, absoluteIndex, state.selectedIndex);
    ttyWrite(ttyFd, `\n${line}`);
  }

  const remaining = totalMatches - WIDGET_MAX_VISIBLE;
  const hasMore = remaining > 0;
  if (hasMore) {
    ttyWrite(ttyFd, `\n${DIM}... ${remaining} more${RESET}`);
  }

  const lineCount = visibleMatches.length + (hasMore ? 1 : 0);
  return lineCount;
}

export function createWidgetContext(): WidgetContext | null {
  const ttyFd = os.open("/dev/tty", os.O_WRONLY);
  const isValid = ttyFd >= 0;
  if (!isValid) return null;

  const stdinFd = std.in.fileno();
  os.ttySetRaw(stdinFd);
  ttyWrite(ttyFd, HIDE_CURSOR);

  return { ttyFd, stdinFd, lineCount: 0 };
}

export function cleanupWidgetContext(ctx: WidgetContext | null): void {
  if (!ctx) return;

  for (let i = 0; i < ctx.lineCount; i++) {
    ttyWrite(ctx.ttyFd, MOVE_UP);
    ttyWrite(ctx.ttyFd, CLEAR_LINE);
  }
  ttyWrite(ctx.ttyFd, SHOW_CURSOR);

  os.ttySetRaw(ctx.stdinFd, false);
  os.close(ctx.ttyFd);
}

export function readWidgetKey(stdinFd: number): Uint8Array | null {
  const buf = new Uint8Array(16);
  const n = os.read(stdinFd, buf.buffer, 0, buf.length);
  return n > 0 ? buf.slice(0, n) : null;
}

export function handleWidgetArrowKey(
  state: InteractiveState<PackageScript>,
  key: Uint8Array,
): number {
  const isUpArrow = key[2] === KEY_CODES.ARROW_UP;
  const isDownArrow = key[2] === KEY_CODES.ARROW_DOWN;

  if (isUpArrow) {
    return Math.max(0, state.selectedIndex - 1);
  }
  if (isDownArrow) {
    return Math.min(state.matches.length - 1, state.selectedIndex + 1);
  }
  return state.selectedIndex;
}

export function handleWidgetBackspace(
  state: InteractiveState<PackageScript>,
  scripts: PackageScript[],
): InteractiveState<PackageScript> {
  const hasQuery = state.query.length > 0;
  if (!hasQuery) return state;

  const newQuery = state.query.slice(0, -1);
  return updateState(state, newQuery, scripts, getScriptText);
}

export function handleWidgetPrintable(
  state: InteractiveState<PackageScript>,
  byte0: number,
  scripts: PackageScript[],
): InteractiveState<PackageScript> {
  const char = String.fromCharCode(byte0);
  const newQuery = state.query + char;
  return updateState(state, newQuery, scripts, getScriptText);
}

export function outputWidgetSelection(
  state: InteractiveState<PackageScript>,
  executeDirectly: boolean,
): void {
  const hasSelection = state.matches.length > 0;
  if (!hasSelection) return;

  const selected = state.matches[state.selectedIndex];

  if (executeDirectly) {
    executeScript(selected.item);
  } else {
    std.out.puts(selected.item.name);
    std.out.flush();
  }
}

export function runWidget(
  scripts: PackageScript[],
  initialQuery: string,
): void {
  const hasNoScripts = scripts.length === 0;
  if (hasNoScripts) {
    std.exit(0);
  }

  const ctx = createWidgetContext();
  if (!ctx) {
    std.exit(1);
  }

  let state = createInitialState(scripts, getScriptText);

  if (initialQuery) {
    state = updateState(state, initialQuery, scripts, getScriptText);
  }

  ctx.lineCount = renderWidget(ctx.ttyFd, state, 0);

  while (true) {
    const key = readWidgetKey(ctx.stdinFd);
    if (!key) continue;

    const byte0 = key[0];

    if (isExitKey(byte0, key)) {
      cleanupWidgetContext(ctx);
      std.exit(0);
    }

    if (isEnterKey(byte0)) {
      cleanupWidgetContext(ctx);
      const stdoutIsTty = os.isatty(std.out.fileno());
      outputWidgetSelection(state, stdoutIsTty);
      if (stdoutIsTty) return;
      std.exit(0);
    }

    if (isArrowSequence(byte0, key)) {
      state.selectedIndex = handleWidgetArrowKey(state, key);
      ctx.lineCount = renderWidget(ctx.ttyFd, state, ctx.lineCount);
      continue;
    }

    if (isBackspaceKey(byte0)) {
      state = handleWidgetBackspace(state, scripts);
      ctx.lineCount = renderWidget(ctx.ttyFd, state, ctx.lineCount);
      continue;
    }

    if (isPrintableChar(byte0)) {
      state = handleWidgetPrintable(state, byte0, scripts);
      ctx.lineCount = renderWidget(ctx.ttyFd, state, ctx.lineCount);
    }
  }
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

  if (options.mode === "init") {
    runInit(options.initMode);
    return;
  }

  const cwd = getCwd();

  if (options.mode === "run-key") {
    runKey(options.filePath, options.runKey);
    return;
  }

  if (options.mode === "find") {
    const fileName = options.filePath || "package.json";
    const entries = discoverFilesByNameEntries(fileName, cwd);
    const title = `Find: ${fileName}`;
    runInteractive(
      entries,
      (e: JsonEntry) => `${e.path} ${e.workspace}`,
      renderJson,
      title,
    );
    return;
  }

  if (options.mode === "path") {
    if (!options.filePath) {
      std.err.puts(`${YELLOW}Error: No file path provided${RESET}\n`);
      std.exit(1);
    }
    const absolutePath = options.filePath.startsWith("/")
      ? options.filePath
      : join(cwd, options.filePath);
    const entries = discoverJsonEntries([absolutePath], cwd);
    const title = `Path: ${options.filePath}`;
    runInteractive(
      entries,
      (e: JsonEntry) => `${e.path} ${e.workspace}`,
      renderJson,
      title,
    );
    return;
  }

  const scripts = discoverScripts(options.filePath);

  if (options.completions) {
    runCompletions(options.completionsQuery, scripts);
    return;
  }

  if (options.widget) {
    runWidget(scripts, options.widgetQuery);
    return;
  }

  const selected = runInteractive(
    scripts,
    getScriptText,
    renderScripts,
    "Fuzzy NPM Scripts",
  );

  if (selected) {
    executeScript(selected.item);
  }
}

main();
