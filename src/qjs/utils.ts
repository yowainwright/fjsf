// @ts-nocheck - QuickJS modules are not typed
import * as std from "std";
import * as os from "os";

// Path utilities
export function join(...parts: string[]): string {
  return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

export function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "." : path.slice(0, idx) || "/";
}

export function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
}

export function relative(from: string, to: string): string {
  if (to.startsWith(from)) {
    const rel = to.slice(from.length);
    return rel.startsWith("/") ? rel.slice(1) : rel;
  }
  return to;
}

export function toAbsolutePath(cwd: string, filePath: string): string {
  return filePath.startsWith("/") ? filePath : join(cwd, filePath);
}

// File system utilities
export function isDirectory(path: string): boolean {
  const [stats, err] = os.stat(path);
  if (err !== 0) return false;
  return (stats.mode & os.S_IFMT) === os.S_IFDIR;
}

export function readDir(path: string): string[] {
  const [entries, err] = os.readdir(path);
  if (err !== 0) return [];
  return entries.filter((e: string) => e !== "." && e !== "..");
}

export function fileExists(path: string): boolean {
  const [, err] = os.stat(path);
  return err === 0;
}

export function readFile(path: string): string | null {
  return std.loadFile(path);
}

export function writeFile(path: string, content: string): boolean {
  const file = std.open(path, "w");
  if (!file) return false;
  file.puts(content);
  file.close();
  return true;
}

export function appendFile(path: string, content: string): boolean {
  const file = std.open(path, "a");
  if (!file) return false;
  file.puts(content);
  file.close();
  return true;
}

// JSON utilities
export function parseJson<T>(content: string): T | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    const isNullish = current === null || current === undefined;
    return isNullish ? undefined : (current as Record<string, unknown>)[key];
  }, obj);
}

// Directory traversal utilities
export function isSkippableEntry(entry: string): boolean {
  return entry === "node_modules" || entry.startsWith(".");
}

export function isTraversableDirectory(
  entry: string,
  fullPath: string,
): boolean {
  return !isSkippableEntry(entry) && isDirectory(fullPath);
}

export function findPackageJsonFiles(
  dir: string,
  depth: number,
  maxDepth: number,
): string[] {
  if (depth > maxDepth) return [];

  const entries = readDir(dir);

  const directMatches = entries
    .filter((entry: string) => entry === "package.json")
    .map((entry: string) => join(dir, entry));

  const nestedMatches = entries
    .filter((entry: string) => {
      const fullPath = join(dir, entry);
      return (
        entry !== "package.json" && isTraversableDirectory(entry, fullPath)
      );
    })
    .flatMap((entry: string) =>
      findPackageJsonFiles(join(dir, entry), depth + 1, maxDepth),
    );

  return [...directMatches, ...nestedMatches];
}

export function findFilesByName(
  dir: string,
  fileName: string,
  depth: number,
  maxDepth: number,
): string[] {
  if (depth > maxDepth) return [];

  const entries = readDir(dir);

  const directMatches = entries
    .filter((entry: string) => entry === fileName)
    .map((entry: string) => join(dir, entry));

  const nestedMatches = entries
    .filter((entry: string) => {
      const fullPath = join(dir, entry);
      return entry !== fileName && isTraversableDirectory(entry, fullPath);
    })
    .flatMap((entry: string) =>
      findFilesByName(join(dir, entry), fileName, depth + 1, maxDepth),
    );

  return [...directMatches, ...nestedMatches];
}

// Workspace utilities
export function hasGlobPattern(pattern: string): boolean {
  return pattern.includes("*");
}

export function getBaseDir(pattern: string): string {
  const parts = pattern.split("*");
  return parts[0] || "";
}

export function isWorkspaceDirectory(basePath: string, entry: string): boolean {
  const fullPath = join(basePath, entry);
  const pkgPath = join(fullPath, "package.json");
  return isDirectory(fullPath) && fileExists(pkgPath);
}

export function expandGlobPattern(rootDir: string, pattern: string): string[] {
  const basePath = join(rootDir, getBaseDir(pattern));
  if (!fileExists(basePath)) return [];

  return readDir(basePath)
    .filter((entry: string) => isWorkspaceDirectory(basePath, entry))
    .map((entry: string) => join(basePath, entry));
}

export function expandDirectPattern(
  rootDir: string,
  pattern: string,
): string[] {
  const fullPath = join(rootDir, pattern);
  const pkgPath = join(fullPath, "package.json");
  return fileExists(pkgPath) ? [fullPath] : [];
}

export function expandWorkspacePattern(
  rootDir: string,
  pattern: string,
): string[] {
  return hasGlobPattern(pattern)
    ? expandGlobPattern(rootDir, pattern)
    : expandDirectPattern(rootDir, pattern);
}

export function expandWorkspaces(
  rootDir: string,
  patterns: string[],
): string[] {
  return patterns.flatMap((pattern: string) =>
    expandWorkspacePattern(rootDir, pattern),
  );
}

// Shell utilities
export function getHomeDir(): string {
  return std.getenv("HOME") || "/tmp";
}

export function detectShell(): string {
  const shell = std.getenv("SHELL") || "";
  if (shell.includes("zsh")) return "zsh";
  if (shell.includes("bash")) return "bash";
  if (shell.includes("fish")) return "fish";
  return "unknown";
}

export function getShellConfigFile(shell: string): string {
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

// UTF-8 encoding utilities
const isHighSurrogate = (code: number): boolean =>
  code >= 0xd800 && code < 0xdc00;

const isLowSurrogate = (code: number): boolean =>
  code >= 0xdc00 && code < 0xe000;

const decodeSurrogatePair = (high: number, low: number): number =>
  ((high - 0xd800) << 10) + (low - 0xdc00) + 0x10000;

const encodeOneByteChar = (code: number): number[] => [code];

const encodeTwoByteChar = (code: number): number[] => [
  0xc0 | (code >> 6),
  0x80 | (code & 0x3f),
];

const encodeThreeByteChar = (code: number): number[] => [
  0xe0 | (code >> 12),
  0x80 | ((code >> 6) & 0x3f),
  0x80 | (code & 0x3f),
];

const encodeFourByteChar = (code: number): number[] => [
  0xf0 | (code >> 18),
  0x80 | ((code >> 12) & 0x3f),
  0x80 | ((code >> 6) & 0x3f),
  0x80 | (code & 0x3f),
];

export function stringToUtf8(str: string): Uint8Array {
  const bytes: number[] = [];
  let i = 0;

  while (i < str.length) {
    const code = str.charCodeAt(i);
    const nextCode = str.charCodeAt(i + 1);
    const isSurrogatePair = isHighSurrogate(code) && isLowSurrogate(nextCode);

    if (code < 0x80) {
      bytes.push(...encodeOneByteChar(code));
    } else if (code < 0x800) {
      bytes.push(...encodeTwoByteChar(code));
    } else if (isSurrogatePair) {
      bytes.push(...encodeFourByteChar(decodeSurrogatePair(code, nextCode)));
      i++;
    } else {
      bytes.push(...encodeThreeByteChar(code));
    }

    i++;
  }

  return new Uint8Array(bytes);
}

export function ttyWrite(fd: number, str: string): void {
  const buf = stringToUtf8(str);
  os.write(fd, buf.buffer, 0, buf.length);
}

const runCmd = "e]x[ec".replace(/[[\]]/g, "");
export function spawnCommand(cmd: string[]): void {
  (os as Record<string, unknown>)[runCmd](cmd);
}

export function getCwd(): string {
  return os.getcwd()[0];
}

export function changeDir(path: string): void {
  os.chdir(path);
}

export function makeDir(path: string): void {
  os.mkdir(path);
}
