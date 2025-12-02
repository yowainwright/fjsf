import * as std from "std";
import * as os from "os";
import { fuzzySearch, getScriptText } from "./core.js";
import { VERSION, HELP_TEXT } from "./constants.js";
import { SHELL_SCRIPTS } from "./shell-scripts.js";
import { KEY_CODES, COLORS, TERMINAL, MAX_VISIBLE } from "./key-codes.js";

const { CYAN, GREEN, YELLOW, GRAY, DIM, BOLD, RESET } = COLORS;
const { HIDE_CURSOR, SHOW_CURSOR, CLEAR_SCREEN } = TERMINAL;

export function join(...parts) {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

export function dirname(path) {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "." : path.slice(0, idx) || "/";
}

export function basename(path) {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
}

export function relative(from, to) {
  if (to.startsWith(from)) {
    const rel = to.slice(from.length);
    return rel.startsWith("/") ? rel.slice(1) : rel;
  }
  return to;
}

export function isDirectory(path) {
  const [stats, err] = os.stat(path);
  if (err !== 0) return false;
  return (stats.mode & os.S_IFMT) === os.S_IFDIR;
}

export function readDir(path) {
  const [entries, err] = os.readdir(path);
  if (err !== 0) return [];
  return entries.filter((e) => e !== "." && e !== "..");
}

export function fileExists(path) {
  const [, err] = os.stat(path);
  return err === 0;
}

export function readFile(path) {
  return std.loadFile(path);
}

export function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function isSkippableEntry(entry) {
  return entry === "node_modules" || entry.startsWith(".");
}

export function isTraversableDirectory(entry, fullPath) {
  return !isSkippableEntry(entry) && isDirectory(fullPath);
}

export function findPackageJsonFiles(dir, depth, maxDepth) {
  if (depth > maxDepth) return [];

  const entries = readDir(dir);

  const directMatches = entries
    .filter((entry) => entry === "package.json")
    .map((entry) => join(dir, entry));

  const nestedMatches = entries
    .filter((entry) => {
      const fullPath = join(dir, entry);
      return (
        entry !== "package.json" && isTraversableDirectory(entry, fullPath)
      );
    })
    .flatMap((entry) =>
      findPackageJsonFiles(join(dir, entry), depth + 1, maxDepth),
    );

  return [...directMatches, ...nestedMatches];
}

export function findFilesByName(dir, fileName, depth, maxDepth) {
  if (depth > maxDepth) return [];

  const entries = readDir(dir);

  const directMatches = entries
    .filter((entry) => entry === fileName)
    .map((entry) => join(dir, entry));

  const nestedMatches = entries
    .filter((entry) => {
      const fullPath = join(dir, entry);
      return entry !== fileName && isTraversableDirectory(entry, fullPath);
    })
    .flatMap((entry) =>
      findFilesByName(join(dir, entry), fileName, depth + 1, maxDepth),
    );

  return [...directMatches, ...nestedMatches];
}

export function hasGlobPattern(pattern) {
  return pattern.includes("*");
}

export function getBaseDir(pattern) {
  const parts = pattern.split("*");
  return parts[0] || "";
}

export function isWorkspaceDirectory(basePath, entry) {
  const fullPath = join(basePath, entry);
  const pkgPath = join(fullPath, "package.json");
  return isDirectory(fullPath) && fileExists(pkgPath);
}

export function expandGlobPattern(rootDir, pattern) {
  const basePath = join(rootDir, getBaseDir(pattern));
  if (!fileExists(basePath)) return [];

  return readDir(basePath)
    .filter((entry) => isWorkspaceDirectory(basePath, entry))
    .map((entry) => join(basePath, entry));
}

export function expandDirectPattern(rootDir, pattern) {
  const fullPath = join(rootDir, pattern);
  const pkgPath = join(fullPath, "package.json");
  return fileExists(pkgPath) ? [fullPath] : [];
}

export function expandWorkspacePattern(rootDir, pattern) {
  return hasGlobPattern(pattern)
    ? expandGlobPattern(rootDir, pattern)
    : expandDirectPattern(rootDir, pattern);
}

export function expandWorkspaces(rootDir, patterns) {
  return patterns.flatMap((pattern) =>
    expandWorkspacePattern(rootDir, pattern),
  );
}

export function getWorkspacePatterns(packageJson) {
  const workspaces = packageJson.workspaces;
  if (Array.isArray(workspaces)) return workspaces;
  if (workspaces && workspaces.packages) return workspaces.packages;
  return [];
}

export function extractScriptsFromPackage(cwd, packagePath) {
  const content = readFile(packagePath);
  if (!content) return [];

  const pkg = parseJson(content);
  const hasScripts = pkg && pkg.scripts;
  if (!hasScripts) return [];

  const dir = packagePath.replace(/\/package\.json$/, "");
  const workspace = pkg.name || relative(cwd, dir);
  const relativePath = relative(cwd, packagePath);

  return Object.entries(pkg.scripts).map(([name, command]) => ({
    name,
    command,
    workspace,
    packagePath: relativePath,
  }));
}

export function toAbsolutePath(cwd, filePath) {
  return filePath.startsWith("/") ? filePath : join(cwd, filePath);
}

export function discoverScriptsFromFile(cwd, filePath) {
  const absolutePath = toAbsolutePath(cwd, filePath);
  if (!fileExists(absolutePath)) return [];
  return extractScriptsFromPackage(cwd, absolutePath);
}

export function discoverScriptsFromAllPackages(cwd, rootPkgPath, rootScripts) {
  const nestedScripts = findPackageJsonFiles(cwd, 0, 5)
    .filter((pkgPath) => pkgPath !== rootPkgPath)
    .flatMap((pkgPath) => extractScriptsFromPackage(cwd, pkgPath));

  return [...rootScripts, ...nestedScripts];
}

export function discoverScriptsFromWorkspaces(cwd, patterns, rootScripts) {
  const workspaceScripts = expandWorkspaces(cwd, patterns)
    .map((dir) => join(dir, "package.json"))
    .flatMap((pkgPath) => extractScriptsFromPackage(cwd, pkgPath));

  return [...rootScripts, ...workspaceScripts];
}

export function discoverScripts(cwdOrFilePath) {
  const cwd = os.getcwd()[0];

  const isSpecificFile = cwdOrFilePath && cwdOrFilePath.endsWith(".json");
  if (isSpecificFile) {
    return discoverScriptsFromFile(cwd, cwdOrFilePath);
  }

  const rootPkgPath = join(cwd, "package.json");
  if (!fileExists(rootPkgPath)) return [];

  const content = readFile(rootPkgPath);
  const pkg = parseJson(content);
  if (!pkg) return [];

  const rootScripts = extractScriptsFromPackage(cwd, rootPkgPath);
  const patterns = getWorkspacePatterns(pkg);

  const hasNoWorkspaces = patterns.length === 0;
  if (hasNoWorkspaces) {
    return discoverScriptsFromAllPackages(cwd, rootPkgPath, rootScripts);
  }

  return discoverScriptsFromWorkspaces(cwd, patterns, rootScripts);
}

export function detectPackageManager(cwd) {
  if (fileExists(join(cwd, "bun.lockb")) || fileExists(join(cwd, "bun.lock")))
    return "bun";
  if (fileExists(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (fileExists(join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

export function buildRunCommand(script, pm) {
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

export function createEntry(path, value, key, filePath, workspace) {
  return { path, value, key, filePath, workspace };
}

export function flattenValue(value, path, key, filePath, workspace) {
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
    const childEntries = value.flatMap((item, i) =>
      flattenValue(item, `${path}[${i}]`, `[${i}]`, filePath, workspace),
    );
    return [selfEntry, ...childEntries];
  }

  const isObject = typeof value === "object";
  if (isObject) {
    const keys = Object.keys(value);
    const selfEntry = createEntry(
      path,
      `Object(${keys.length})`,
      key,
      filePath,
      workspace,
    );
    const childEntries = keys.flatMap((k) => {
      const newPath = path ? `${path}.${k}` : k;
      return flattenValue(value[k], newPath, k, filePath, workspace);
    });
    return [selfEntry, ...childEntries];
  }

  return [createEntry(path, String(value), key, filePath, workspace)];
}

export function flattenJson(obj, prefix, filePath, workspace) {
  return Object.keys(obj).flatMap((k) =>
    flattenValue(obj[k], k, k, filePath, workspace),
  );
}

export function parseJsonFile(filePath, cwd) {
  if (!fileExists(filePath)) return null;

  const content = readFile(filePath);
  const json = parseJson(content);
  if (!json) return null;

  const relativePath = relative(cwd, filePath);
  const workspace = json.name || relativePath;

  return { json, relativePath, workspace };
}

export function discoverJsonEntries(filePaths, cwd) {
  return filePaths
    .map((filePath) => parseJsonFile(filePath, cwd))
    .filter((result) => result !== null)
    .flatMap(({ json, relativePath, workspace }) =>
      flattenJson(json, "", relativePath, workspace),
    );
}

export function discoverAllPackageJsons(cwd) {
  const paths = findPackageJsonFiles(cwd, 0, 5);
  return discoverJsonEntries(paths, cwd);
}

export function discoverFilesByNameEntries(fileName, cwd) {
  const paths = findFilesByName(cwd, fileName, 0, 5);
  return discoverJsonEntries(paths, cwd);
}

export function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => {
    const isNullish = current === null || current === undefined;
    return isNullish ? undefined : current[key];
  }, obj);
}

export function getSelectionPrefix(index, selectedIndex) {
  const isSelected = index === selectedIndex;
  return isSelected ? `${GREEN}>${RESET}` : " ";
}

export function formatScriptLine(match, index, selectedIndex) {
  const script = match.item;
  const prefix = getSelectionPrefix(index, selectedIndex);
  const nameLine = `${prefix} ${script.name} ${DIM}[${script.workspace}]${RESET}`;
  const commandLine = `  ${GRAY}${script.command}${RESET}`;
  return [nameLine, commandLine];
}

export function formatJsonLine(match, index, selectedIndex) {
  const entry = match.item;
  const prefix = getSelectionPrefix(index, selectedIndex);
  const pathLine = `${prefix} ${entry.path} ${DIM}[${entry.workspace}]${RESET}`;
  const valueLine = `  ${GRAY}${entry.value}${RESET}`;
  return [pathLine, valueLine];
}

export function buildRemainingLines(matches) {
  const remaining = matches.length - MAX_VISIBLE;
  const hasMore = remaining > 0;
  return hasMore ? [`${DIM}`, `... ${remaining} more${RESET}`] : [];
}

export function renderList(state, title, formatLine) {
  const visibleMatches = state.matches.slice(0, MAX_VISIBLE);

  const headerLines = [
    `${BOLD}${CYAN}${title}${RESET}`,
    "",
    `Search: ${state.query}`,
    "",
  ];

  const itemLines = visibleMatches.flatMap((match, i) =>
    formatLine(match, i, state.selectedIndex),
  );

  const remainingLines = buildRemainingLines(state.matches);
  const allLines = [...headerLines, ...itemLines, ...remainingLines];

  std.out.puts(CLEAR_SCREEN + allLines.join("\n") + "\n");
  std.out.flush();
}

export function renderScripts(state) {
  renderList(state, "Fuzzy NPM Scripts", formatScriptLine);
}

export function renderJson(state, title) {
  renderList(state, title, formatJsonLine);
}

export function updateState(state, query, items, getText) {
  const matches = fuzzySearch(items, query, getText);
  const clampedIndex = Math.min(
    state.selectedIndex,
    Math.max(0, matches.length - 1),
  );
  return { query, selectedIndex: clampedIndex, matches, items };
}

export function matchesQuery(script, lowerQuery) {
  if (!lowerQuery) return true;
  const nameMatches = script.name.toLowerCase().includes(lowerQuery);
  const workspaceMatches = script.workspace.toLowerCase().includes(lowerQuery);
  return nameMatches || workspaceMatches;
}

export function formatCompletion(script) {
  return `${script.name}:[${script.workspace}] ${script.command}`;
}

export function runCompletions(query, scripts) {
  const lowerQuery = (query || "").toLowerCase();

  scripts
    .filter((s) => matchesQuery(s, lowerQuery))
    .map(formatCompletion)
    .forEach((line) => print(line));
}

export function executeScript(script) {
  const cwd = os.getcwd()[0];
  const pm = detectPackageManager(cwd);
  const cmd = buildRunCommand(script, pm);

  std.out.puts(SHOW_CURSOR);
  std.out.puts(CLEAR_SCREEN);
  std.out.puts(`${CYAN}Running: ${cmd.join(" ")}${RESET}\n\n`);
  std.out.flush();

  os.exec(cmd);
}

export function exitWithError(message) {
  std.err.puts(`${YELLOW}Error: ${message}${RESET}\n`);
  std.exit(1);
}

export function validateExecInputs(filePath, execKey) {
  if (!filePath) exitWithError("No file path provided");
  if (!execKey) exitWithError("No key provided");
}

export function loadAndParseJson(absolutePath, filePath) {
  const content = readFile(absolutePath);
  if (!content) exitWithError(`Could not read ${filePath}`);

  const json = parseJson(content);
  if (!json) exitWithError(`Invalid JSON in ${filePath}`);

  return json;
}

export function validateExecKey(value, execKey, filePath) {
  const isUndefined = value === undefined;
  if (isUndefined) exitWithError(`Key "${execKey}" not found in ${filePath}`);

  const isNotString = typeof value !== "string";
  if (isNotString)
    exitWithError(`Cannot execute "${execKey}" - value is not a string`);

  const isNotScript = !execKey.startsWith("scripts.");
  if (isNotScript)
    exitWithError(
      `Cannot execute "${execKey}" - not a script (must start with "scripts.")`,
    );
}

export function buildSimpleRunCommand(pm, scriptName) {
  const commands = {
    pnpm: ["pnpm", "run", scriptName],
    yarn: ["yarn", "run", scriptName],
    bun: ["bun", "run", scriptName],
    npm: ["npm", "run", scriptName],
  };
  return commands[pm] || commands.npm;
}

export function executeKey(filePath, execKey) {
  validateExecInputs(filePath, execKey);

  const cwd = os.getcwd()[0];
  const absolutePath = toAbsolutePath(cwd, filePath);
  const json = loadAndParseJson(absolutePath, filePath);
  const value = getNestedValue(json, execKey);

  validateExecKey(value, execKey, filePath);

  const scriptName = execKey.substring("scripts.".length);
  const packageDir = dirname(absolutePath);
  const pm = detectPackageManager(packageDir);
  const cmd = buildSimpleRunCommand(pm, scriptName);

  std.out.puts(`${CYAN}Running: ${cmd.join(" ")}${RESET}\n`);
  std.out.puts(`${CYAN}From: ${filePath}${RESET}\n\n`);
  std.out.flush();

  os.chdir(packageDir);
  os.exec(cmd);
}

export function createDefaultOptions() {
  return {
    help: false,
    version: false,
    quit: false,
    completions: false,
    completionsQuery: "",
    mode: "scripts",
    filePath: undefined,
    execKey: undefined,
    initMode: "widget",
  };
}

export function isHelpArg(arg) {
  return ["help", "h", "--help", "-h"].includes(arg);
}

export function isVersionArg(arg) {
  return ["--version", "-v"].includes(arg);
}

export function isQuitArg(arg) {
  return ["quit", "q"].includes(arg);
}

export function isCompletionsArg(arg) {
  return ["completions", "--completions"].includes(arg);
}

export function isFindArg(arg) {
  return ["find", "f"].includes(arg);
}

export function isPathArg(arg) {
  return ["path", "p"].includes(arg);
}

export function isExecArg(arg) {
  return ["exec", "e"].includes(arg);
}

export function hasNextArg(args, i) {
  return i + 1 < args.length;
}

export function getNextArg(args, i) {
  return hasNextArg(args, i) ? args[i + 1] : undefined;
}

export function parseArgs(args) {
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
    } else if (isExecArg(arg)) {
      options.mode = "exec";
      if (nextArg) {
        options.filePath = nextArg;
        i++;
      }
      const execKeyArg = getNextArg(args, i);
      if (execKeyArg) {
        options.execKey = execKeyArg;
        i++;
      }
    } else if (arg.endsWith(".json")) {
      options.filePath = arg;
    }

    i++;
  }

  return options;
}

export function readKey() {
  const buf = new Uint8Array(16);
  const n = os.read(std.in.fileno(), buf.buffer, 0, buf.length);
  const hasData = n > 0;
  return hasData ? buf.slice(0, n) : null;
}

export function isExitKey(byte0, key) {
  const isCtrlC = byte0 === KEY_CODES.CTRL_C;
  const isEscape = byte0 === KEY_CODES.ESCAPE && key.length === 1;
  const isQKey = byte0 === KEY_CODES.Q;
  return isCtrlC || isEscape || isQKey;
}

export function isEnterKey(byte0) {
  return byte0 === KEY_CODES.ENTER_CR || byte0 === KEY_CODES.ENTER_LF;
}

export function isArrowSequence(byte0, key) {
  return (
    byte0 === KEY_CODES.ESCAPE &&
    key.length >= 3 &&
    key[1] === KEY_CODES.BRACKET
  );
}

export function isBackspaceKey(byte0) {
  return byte0 === KEY_CODES.DELETE || byte0 === KEY_CODES.BACKSPACE;
}

export function isPrintableChar(byte0) {
  return byte0 >= KEY_CODES.PRINTABLE_START && byte0 < KEY_CODES.PRINTABLE_END;
}

export function createInitialState(items, getText) {
  return {
    query: "",
    selectedIndex: 0,
    matches: fuzzySearch(items, "", getText),
    items,
  };
}

export function cleanupTerminal() {
  std.out.puts(SHOW_CURSOR);
  std.out.puts(CLEAR_SCREEN);
  os.ttySetRaw(std.in.fileno(), false);
}

export function handleArrowKey(state, key, render, title) {
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

export function handleBackspace(state, items, getText, render, title) {
  const hasQuery = state.query.length > 0;
  if (!hasQuery) return state;

  const newQuery = state.query.slice(0, -1);
  const newState = updateState(state, newQuery, items, getText);
  render(newState, title);
  return newState;
}

export function handlePrintableChar(
  state,
  byte0,
  items,
  getText,
  render,
  title,
) {
  const char = String.fromCharCode(byte0);
  const newQuery = state.query + char;
  const newState = updateState(state, newQuery, items, getText);
  render(newState, title);
  return newState;
}

export function runInteractive(items, getText, render, title) {
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
    const key = readKey();
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

export function getHomeDir() {
  return std.getenv("HOME") || "/tmp";
}

export function detectShell() {
  const shell = std.getenv("SHELL") || "";
  if (shell.includes("zsh")) return "zsh";
  if (shell.includes("bash")) return "bash";
  if (shell.includes("fish")) return "fish";
  return "unknown";
}

export function getShellConfigFile(shell) {
  const home = getHomeDir();

  if (shell === "zsh") {
    const zshrc = join(home, ".zshrc");
    if (fileExists(zshrc)) return zshrc;
    return join(home, ".zprofile");
  }

  if (shell === "bash") {
    const bashrc = join(home, ".bashrc");
    if (fileExists(bashrc)) return bashrc;
    return join(home, ".bash_profile");
  }

  if (shell === "fish") {
    return join(home, ".config", "fish", "config.fish");
  }

  return "";
}

export function writeFile(path, content) {
  const file = std.open(path, "w");
  if (!file) return false;
  file.puts(content);
  file.close();
  return true;
}

export function appendFile(path, content) {
  const file = std.open(path, "a");
  if (!file) return false;
  file.puts(content);
  file.close();
  return true;
}

export function runInit(initMode) {
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
    os.mkdir(fjsfDir);
  }

  print(`${DIM}fjsf directory: ${fjsfDir}${RESET}\n`);

  const integrationFile = join(fjsfDir, `init.${shell}`);

  const scripts = SHELL_SCRIPTS[shell];
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

export function main() {
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

  const cwd = os.getcwd()[0];

  if (options.mode === "exec") {
    executeKey(options.filePath, options.execKey);
    return;
  }

  if (options.mode === "find") {
    const fileName = options.filePath || "package.json";
    const entries = discoverFilesByNameEntries(fileName, cwd);
    const title = `Find: ${fileName}`;
    runInteractive(
      entries,
      (e) => `${e.path} ${e.workspace}`,
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
      (e) => `${e.path} ${e.workspace}`,
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
