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

export type FileFormat = "json" | "toml" | "yaml" | "unknown";

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
  matches: number[];
}

export interface InteractiveState<T> {
  query: string;
  selectedIndex: number;
  matches: FuzzyMatch<T>[];
  items: T[];
}

export interface ParsedOptions {
  help: boolean;
  version: boolean;
  quit: boolean;
  mode: "default" | "find" | "path";
  filePath: string | undefined;
}
