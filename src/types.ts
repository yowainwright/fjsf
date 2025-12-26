// QuickJS std module types
export interface StdFile {
  puts(s: string): void;
  flush(): void;
  close(): void;
  fileno(): number;
}

export interface Std {
  out: StdFile;
  err: StdFile;
  in: StdFile;
  exit(code: number): never;
  loadFile(path: string): string | null;
  open(path: string, mode: string): StdFile | null;
  getenv(name: string): string | undefined;
}

// QuickJS os module types
export interface OsStat {
  mode: number;
}

export interface Os {
  S_IFMT: number;
  S_IFDIR: number;
  O_WRONLY: number;
  stat(path: string): [OsStat, number];
  readdir(path: string): [string[], number];
  read(fd: number, buf: ArrayBuffer, offset: number, length: number): number;
  write(fd: number, buf: ArrayBuffer, offset: number, length: number): number;
  open(path: string, flags: number): number;
  close(fd: number): void;
  getcwd(): [string, number];
  chdir(path: string): number;
  mkdir(path: string, mode?: number): number;
  run(args: string[]): void;
  ttySetRaw(fd: number, raw?: boolean): void;
  isatty(fd: number): boolean;
}

// Script types
export interface PackageScript {
  name: string;
  command: string;
  workspace: string;
  packagePath: string;
}

export interface JsonEntry {
  path: string;
  value: string;
  key: string;
  filePath: string;
  workspace: string;
}

export interface FuzzyMatch<T> {
  item: T;
  score: number;
}

export interface InteractiveState<T> {
  query: string;
  selectedIndex: number;
  matches: FuzzyMatch<T>[];
  items: T[];
}

export interface WidgetContext {
  ttyFd: number;
  stdinFd: number;
  lineCount: number;
}

export interface ParsedOptions {
  help: boolean;
  version: boolean;
  quit: boolean;
  completions: boolean;
  completionsQuery: string;
  widget: boolean;
  widgetQuery: string;
  mode: "scripts" | "find" | "path" | "init" | "run-key";
  filePath: string | undefined;
  runKey: string | undefined;
  initMode: "widget" | "native";
}

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface ShellScripts {
  widget: string;
  native: string;
  completions: string;
}

export interface AllShellScripts {
  zsh: ShellScripts;
  bash: ShellScripts;
  fish: ShellScripts;
}
