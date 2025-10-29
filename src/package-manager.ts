import { existsSync } from "fs";
import { join } from "path";
import type { PackageManager } from "./types.ts";

export function detectPackageManager(
  cwd: string = process.cwd(),
): PackageManager {
  const bunLockPath = join(cwd, "bun.lockb");
  const bunLockExists = existsSync(bunLockPath);
  if (bunLockExists) {
    return "bun";
  }

  const pnpmLockPath = join(cwd, "pnpm-lock.yaml");
  const pnpmLockExists = existsSync(pnpmLockPath);
  if (pnpmLockExists) {
    return "pnpm";
  }

  const yarnLockPath = join(cwd, "yarn.lock");
  const yarnLockExists = existsSync(yarnLockPath);
  if (yarnLockExists) {
    return "yarn";
  }

  const npmLockPath = join(cwd, "package-lock.json");
  const npmLockExists = existsSync(npmLockPath);
  if (npmLockExists) {
    return "npm";
  }

  return "npm";
}

export function getRunCommand(packageManager: PackageManager): string {
  const isBun = packageManager === "bun";
  if (isBun) {
    return "bun run";
  }

  const isPnpm = packageManager === "pnpm";
  if (isPnpm) {
    return "pnpm run";
  }

  const isYarn = packageManager === "yarn";
  if (isYarn) {
    return "yarn";
  }

  const isNpm = packageManager === "npm";
  if (isNpm) {
    return "npm run";
  }

  return "npm run";
}

export function getWorkspaceRunCommand(
  packageManager: PackageManager,
  workspace: string,
): string {
  const isBun = packageManager === "bun";
  if (isBun) {
    const command = "bun run --filter ".concat(workspace);
    return command;
  }

  const isPnpm = packageManager === "pnpm";
  if (isPnpm) {
    const command = "pnpm --filter ".concat(workspace, " run");
    return command;
  }

  const isYarn = packageManager === "yarn";
  if (isYarn) {
    const command = "yarn workspace ".concat(workspace);
    return command;
  }

  const isNpm = packageManager === "npm";
  if (isNpm) {
    const command = "npm run --workspace ".concat(workspace);
    return command;
  }

  const defaultCommand = "npm run --workspace ".concat(workspace);
  return defaultCommand;
}
