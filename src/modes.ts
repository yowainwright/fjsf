export type AppMode =
  | "scripts"
  | "find"
  | "path"
  | "exec"
  | "help"
  | "quit"
  | "init";

export interface ModeConfig {
  mode: AppMode;
  filePath?: string;
  execKey?: string;
}

export const showHelp = (): void => {
  const help = `
fjsf - Fuzzy JSON Search & Filter

USAGE:
  fjsf                      Search and execute npm scripts (default)
  fjsf <package.json>       Search specific package.json scripts
  fjsf find <file>          Find all versions of file and fuzzy search JSON
  fjsf f <file>             Short form of find
  fjsf path <file>          Query a specific JSON file (single file)
  fjsf p <file>             Short form of path
  fjsf exec <file> <key>    Execute a specific key from JSON file
  fjsf e <file> <key>       Short form of exec
  fjsf init                 Setup shell integration (alias, autocomplete)
  fjsf help                 Show this help
  fjsf h                    Short form of help
  fjsf quit                 Exit
  fjsf q                    Short form of quit

EXAMPLES:
  fjsf                            # Search all npm scripts
  fjsf ./package.json             # Search specific package.json scripts
  fjsf find package.json          # Find all package.json, search all
  fjsf f tsconfig.json            # Find all tsconfig.json
  fjsf path ./tsconfig.json       # Query single tsconfig.json file
  fjsf p ./package.json           # Query single package.json
  fjsf exec package.json scripts.build   # Execute build script
  fjsf e package.json scripts.test       # Execute test script

KEYBOARD CONTROLS:
  Type              Fuzzy search
  ↑/↓               Navigate results
  Enter             Execute selected (scripts mode)
  q, Esc, Ctrl+C    Exit
`;
  console.log(help);
};

export const parseCliArgs = (args: string[]): ModeConfig => {
  const firstArg = args[0];
  const command = firstArg;

  if (!command) {
    return Object.assign({}, { mode: "scripts" as const });
  }

  const isHelpMode = command === "help";
  const isHelpShorthand = command === "h";
  const shouldShowHelp = isHelpMode || isHelpShorthand;
  if (shouldShowHelp) {
    return Object.assign({}, { mode: "help" as const });
  }

  const isQuitMode = command === "quit";
  const isQuitShorthand = command === "q";
  const shouldQuit = isQuitMode || isQuitShorthand;
  if (shouldQuit) {
    return Object.assign({}, { mode: "quit" as const });
  }

  const isInitMode = command === "init";
  if (isInitMode) {
    return Object.assign({}, { mode: "init" as const });
  }

  const isFindMode = command === "find";
  const isFindShorthand = command === "f";
  const shouldUseFindMode = isFindMode || isFindShorthand;
  if (shouldUseFindMode) {
    const filePath = args[1];
    const config = Object.assign({}, { mode: "find" as const, filePath });
    return config;
  }

  const isPathMode = command === "path";
  const isPathShorthand = command === "p";
  const shouldUsePathMode = isPathMode || isPathShorthand;
  if (shouldUsePathMode) {
    const filePath = args[1];
    const config = Object.assign({}, { mode: "path" as const, filePath });
    return config;
  }

  const isExecMode = command === "exec";
  const isExecShorthand = command === "e";
  const shouldUseExecMode = isExecMode || isExecShorthand;
  if (shouldUseExecMode) {
    const filePath = args[1];
    const execKey = args[2];
    const config = Object.assign(
      {},
      { mode: "exec" as const, filePath, execKey },
    );
    return config;
  }

  const endsWithJson = command.endsWith(".json");
  if (endsWithJson) {
    return Object.assign({}, { mode: "scripts" as const, filePath: command });
  }

  const defaultConfig = Object.assign({}, { mode: "scripts" as const });
  return defaultConfig;
};

export const getModeTitle = (config: ModeConfig): string => {
  const mode = config.mode;

  const isScriptsMode = mode === "scripts";
  if (isScriptsMode) {
    return "Fuzzy JSON Search & Filter - Scripts";
  }

  const isFindMode = mode === "find";
  if (isFindMode) {
    const fileName = config.filePath || "JSON";
    return `Fuzzy JSON Search & Filter - Find: ${fileName}`;
  }

  const isPathMode = mode === "path";
  if (isPathMode) {
    const fileName = config.filePath || "JSON";
    return `Fuzzy JSON Search & Filter - Path: ${fileName}`;
  }

  return "Fuzzy JSON Search & Filter";
};
