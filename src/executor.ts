import { stdout, exit } from "process";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import {
  detectPackageManager,
  getRunCommand,
  getWorkspaceRunCommand,
} from "./package-manager.ts";
import {
  clearScreen,
  showCursor,
  disableRawMode,
  colors,
  colorize,
} from "./terminal.ts";
import type { PackageScript } from "./types.ts";
import type { ModeConfig } from "./modes.ts";

const isRootScript = (script: PackageScript): boolean => {
  const isRoot = script.workspace === "root";
  const isPackageJson = script.packagePath === "package.json";
  return isRoot || isPackageJson;
};

const buildCommand = (script: PackageScript, cwd: string): string => {
  const packageManager = detectPackageManager(cwd);

  const shouldUseRootCommand = isRootScript(script);
  const runCommand = shouldUseRootCommand
    ? getRunCommand(packageManager)
    : getWorkspaceRunCommand(packageManager, script.workspace);

  const scriptName = script.name;
  const fullCommand = runCommand.concat(" ", scriptName);
  return fullCommand;
};

const announceExecution = (command: string, filePath?: string): void => {
  const prefix = "Running: ";
  const suffix = "\n";
  let message = prefix.concat(command);

  if (filePath) {
    const fileInfo = `\nFrom: ${filePath}`;
    message = message.concat(fileInfo);
  }

  message = message.concat(suffix, "\n");
  const color = colors.bright.concat(colors.green);
  const coloredMessage = colorize(message, color);
  stdout.write(coloredMessage);
};

const spawnProcess = async (command: string, cwd: string): Promise<number> => {
  const commandParts = command.split(" ");
  const stdio: ["inherit", "inherit", "inherit"] = [
    "inherit",
    "inherit",
    "inherit",
  ];
  const options = Object.assign(
    {},
    {
      cwd,
      stdio,
    },
  );

  const proc = Bun.spawn(commandParts, options);

  await proc.exited;
  const exitCode = proc.exitCode;
  const fallbackExitCode = exitCode !== null ? exitCode : 0;
  return fallbackExitCode;
};

export const executeScript = async (script: PackageScript): Promise<void> => {
  const cwd = process.cwd();
  const command = buildCommand(script, cwd);
  const filePath = script.packagePath;

  showCursor();
  disableRawMode();
  clearScreen();

  announceExecution(command, filePath);

  const exitCode = await spawnProcess(command, cwd);
  exit(exitCode);
};

const getNestedValue = (obj: any, path: string): any => {
  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[key];
  }

  return current;
};

export const executeKey = async (config: ModeConfig): Promise<void> => {
  const filePath = config.filePath;
  const execKey = config.execKey;

  if (!filePath) {
    const error = colorize("Error: No file path provided\n", colors.yellow);
    stdout.write(error);
    exit(1);
  }

  if (!execKey) {
    const error = colorize("Error: No key provided\n", colors.yellow);
    stdout.write(error);
    exit(1);
  }

  try {
    const cwd = process.cwd();
    const absolutePath = resolve(cwd, filePath);
    const fileContent = readFileSync(absolutePath, "utf-8");
    const json = JSON.parse(fileContent);

    const value = getNestedValue(json, execKey);

    if (value === undefined) {
      const error = colorize(
        `Error: Key "${execKey}" not found in ${filePath}\n`,
        colors.yellow,
      );
      stdout.write(error);
      exit(1);
    }

    const isString = typeof value === "string";
    const isScript = execKey.startsWith("scripts.");

    if (!isString) {
      const error = colorize(
        `Error: Cannot execute "${execKey}" - value is not a string\n`,
        colors.yellow,
      );
      stdout.write(error);
      exit(1);
    }

    if (!isScript) {
      const error = colorize(
        `Error: Cannot execute "${execKey}" - not a script (must start with "scripts.")\n`,
        colors.yellow,
      );
      stdout.write(error);
      exit(1);
    }

    // Extract script name (everything after "scripts.")
    const scriptName = execKey.substring("scripts.".length);
    const packageDir = dirname(absolutePath);
    const packageManager = detectPackageManager(packageDir);
    const runCommand = getRunCommand(packageManager);
    const fullCommand = `${runCommand} ${scriptName}`;

    announceExecution(fullCommand, filePath);

    const exitCode = await spawnProcess(fullCommand, packageDir);
    exit(exitCode);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const coloredError = colorize(`Error: ${errorMessage}\n`, colors.yellow);
    stdout.write(coloredError);
    exit(1);
  }
};
