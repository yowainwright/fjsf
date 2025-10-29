import { stdout, exit } from "process";
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

const announceExecution = (command: string): void => {
  const prefix = "Running: ";
  const suffix = "\n\n";
  const message = prefix.concat(command, suffix);
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

  showCursor();
  disableRawMode();
  clearScreen();

  announceExecution(command);

  const exitCode = await spawnProcess(command, cwd);
  exit(exitCode);
};
