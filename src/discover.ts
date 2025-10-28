import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve, relative } from 'path';
import type { PackageScript, PackageJson } from './types.ts';

const parsePackageJson = (packagePath: string): PackageJson | null => {
  try {
    const content = readFileSync(packagePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const shouldSkipEntry = (entry: string): boolean =>
  entry === 'node_modules' || entry.startsWith('.');

const getDirectoryEntries = (dir: string): string[] => {
  try {
    return readdirSync(dir).map((entry) => join(dir, entry));
  } catch {
    return [];
  }
};

const findPackageJsonInDirectory = (dir: string, depth: number, maxDepth: number): string[] => {
  if (depth > maxDepth) return [];

  const entries = getDirectoryEntries(dir);
  const directories = entries.filter(isDirectory).filter((path) => !shouldSkipEntry(path));
  const packageJsons = entries.filter((path) => path.endsWith('package.json'));

  const nestedPackageJsons = directories.flatMap((subDir) =>
    findPackageJsonInDirectory(subDir, depth + 1, maxDepth)
  );

  return [...packageJsons, ...nestedPackageJsons];
};

const findAllPackageJsonFiles = (dir: string, maxDepth: number = 5): string[] =>
  findPackageJsonInDirectory(dir, 0, maxDepth);

const hasGlobPattern = (pattern: string): boolean => pattern.includes('*');

const getBaseDir = (pattern: string): string => pattern.split('*')[0] ?? '';

const expandGlobPattern = (rootDir: string, pattern: string): string[] => {
  const basePath = join(rootDir, getBaseDir(pattern));
  if (!existsSync(basePath)) return [];

  return getDirectoryEntries(basePath)
    .filter(isDirectory)
    .filter((path) => existsSync(join(path, 'package.json')));
};

const expandDirectPattern = (rootDir: string, pattern: string): string[] => {
  const fullPath = join(rootDir, pattern);
  return existsSync(join(fullPath, 'package.json')) ? [fullPath] : [];
};

const expandWorkspacePattern = (rootDir: string) => (pattern: string): string[] =>
  hasGlobPattern(pattern)
    ? expandGlobPattern(rootDir, pattern)
    : expandDirectPattern(rootDir, pattern);

const expandWorkspaces = (rootDir: string, patterns: string[]): string[] =>
  patterns.flatMap(expandWorkspacePattern(rootDir));

const getWorkspacePatterns = (packageJson: PackageJson): string[] => {
  if (Array.isArray(packageJson.workspaces)) {
    return packageJson.workspaces;
  }
  if (packageJson.workspaces?.packages) {
    return packageJson.workspaces.packages;
  }
  return [];
};

const createScript = (
  name: string,
  command: string,
  workspace: string,
  packagePath: string
): PackageScript => ({
  name,
  command,
  workspace,
  packagePath,
});

const extractScriptsFromPackage =
  (cwd: string) =>
  (packageJsonPath: string): PackageScript[] => {
    const packageJson = parsePackageJson(packageJsonPath);
    if (!packageJson?.scripts) return [];

    const dir = resolve(packageJsonPath, '..');
    const workspace = packageJson.name || relative(cwd, dir);
    const relativePath = relative(cwd, packageJsonPath);

    return Object.entries(packageJson.scripts).map(([name, command]) =>
      createScript(name, command, workspace, relativePath)
    );
  };

const getRootScripts = (cwd: string, rootPackageJson: PackageJson): PackageScript[] => {
  if (!rootPackageJson.scripts) return [];

  const workspace = rootPackageJson.name || 'root';
  const packagePath = relative(cwd, join(cwd, 'package.json'));

  return Object.entries(rootPackageJson.scripts).map(([name, command]) =>
    createScript(name, command, workspace, packagePath)
  );
};

const getWorkspaceScripts = (cwd: string, workspaceDirs: string[]): PackageScript[] =>
  workspaceDirs
    .map((dir) => join(dir, 'package.json'))
    .flatMap(extractScriptsFromPackage(cwd));

const getNestedScripts = (
  cwd: string,
  rootPackageJsonPath: string
): PackageScript[] => {
  const allPackageJsons = findAllPackageJsonFiles(cwd);
  const nonRootPackageJsons = allPackageJsons.filter((path) => path !== rootPackageJsonPath);

  return nonRootPackageJsons.flatMap(extractScriptsFromPackage(cwd));
};

export const discoverScripts = (cwd: string = process.cwd()): PackageScript[] => {
  const rootPackageJsonPath = join(cwd, 'package.json');

  if (!existsSync(rootPackageJsonPath)) {
    return [];
  }

  const packageJson = parsePackageJson(rootPackageJsonPath);
  if (!packageJson) {
    return [];
  }

  const rootScripts = getRootScripts(cwd, packageJson);
  const workspacePatterns = getWorkspacePatterns(packageJson);

  if (workspacePatterns.length === 0) {
    return [...rootScripts, ...getNestedScripts(cwd, rootPackageJsonPath)];
  }

  const workspaceDirs = expandWorkspaces(cwd, workspacePatterns);
  const workspaceScripts = getWorkspaceScripts(cwd, workspaceDirs);

  return [...rootScripts, ...workspaceScripts];
};
