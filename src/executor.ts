import { stdout, exit } from 'process';
import { detectPackageManager, getRunCommand, getWorkspaceRunCommand } from './package-manager.ts';
import { clearScreen, showCursor, disableRawMode, colors, colorize } from './terminal.ts';
import type { PackageScript } from './types.ts';

const isRootScript = (script: PackageScript): boolean =>
  script.workspace === 'root' || script.packagePath === 'package.json';

const buildCommand = (script: PackageScript, cwd: string): string => {
  const packageManager = detectPackageManager(cwd);

  return isRootScript(script)
    ? `${getRunCommand(packageManager)} ${script.name}`
    : `${getWorkspaceRunCommand(packageManager, script.workspace)} ${script.name}`;
};

const announceExecution = (command: string): void => {
  stdout.write(colorize(`Running: ${command}\n\n`, colors.bright + colors.green));
};

const spawnProcess = async (command: string, cwd: string): Promise<number> => {
  const proc = Bun.spawn(command.split(' '), {
    cwd,
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  await proc.exited;
  return proc.exitCode ?? 0;
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
