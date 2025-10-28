import { existsSync } from 'fs';
import { join } from 'path';
import type { PackageManager } from './types.ts';

export function detectPackageManager(cwd: string = process.cwd()): PackageManager {
  if (existsSync(join(cwd, 'bun.lockb'))) {
    return 'bun';
  }
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(join(cwd, 'package-lock.json'))) {
    return 'npm';
  }
  return 'npm';
}

export function getRunCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'bun':
      return 'bun run';
    case 'pnpm':
      return 'pnpm run';
    case 'yarn':
      return 'yarn';
    case 'npm':
      return 'npm run';
  }
}

export function getWorkspaceRunCommand(
  packageManager: PackageManager,
  workspace: string
): string {
  switch (packageManager) {
    case 'bun':
      return `bun run --filter ${workspace}`;
    case 'pnpm':
      return `pnpm --filter ${workspace} run`;
    case 'yarn':
      return `yarn workspace ${workspace}`;
    case 'npm':
      return `npm run --workspace ${workspace}`;
  }
}
