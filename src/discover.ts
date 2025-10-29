import { readdirSync, statSync, existsSync } from "fs";
import { join, resolve, relative } from "path";
import { readJsonWithCache } from "./cache.ts";
import type { PackageScript, PackageJson } from "./types.ts";

const parsePackageJson = (packagePath: string): PackageJson | null => {
  return readJsonWithCache(packagePath) as PackageJson | null;
};

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const shouldSkipEntry = (entry: string): boolean => {
  const isNodeModules = entry === "node_modules";
  const isHidden = entry.startsWith(".");
  return isNodeModules || isHidden;
};

const getDirectoryEntries = (dir: string): string[] => {
  try {
    const entries = readdirSync(dir);
    const mapper = (entry: string): string => join(dir, entry);
    return entries.map(mapper);
  } catch {
    return [];
  }
};

const findPackageJsonInDirectory = (
  dir: string,
  depth: number,
  maxDepth: number,
): string[] => {
  const exceedsMaxDepth = depth > maxDepth;
  if (exceedsMaxDepth) return [];

  const entries = getDirectoryEntries(dir);
  const directories = entries
    .filter(isDirectory)
    .filter((path) => !shouldSkipEntry(path));
  const packageJsons = entries.filter((path) => path.endsWith("package.json"));

  const mapper = (subDir: string): string[] =>
    findPackageJsonInDirectory(subDir, depth + 1, maxDepth);
  const nestedPackageJsons = directories
    .map(mapper)
    .reduce((acc, curr) => acc.concat(curr), []);

  return packageJsons.concat(nestedPackageJsons);
};

const findAllPackageJsonFiles = (dir: string, maxDepth: number = 5): string[] =>
  findPackageJsonInDirectory(dir, 0, maxDepth);

const hasGlobPattern = (pattern: string): boolean => pattern.includes("*");

const getBaseDir = (pattern: string): string => {
  const parts = pattern.split("*");
  const firstPart = parts[0];
  return firstPart !== undefined ? firstPart : "";
};

const expandGlobPattern = (rootDir: string, pattern: string): string[] => {
  const basePath = join(rootDir, getBaseDir(pattern));
  const basePathExists = existsSync(basePath);

  if (!basePathExists) return [];

  const entries = getDirectoryEntries(basePath);
  const dirs = entries.filter(isDirectory);
  const filter = (path: string): boolean => {
    const packageJsonPath = join(path, "package.json");
    return existsSync(packageJsonPath);
  };
  return dirs.filter(filter);
};

const expandDirectPattern = (rootDir: string, pattern: string): string[] => {
  const fullPath = join(rootDir, pattern);
  const packageJsonPath = join(fullPath, "package.json");
  const packageJsonExists = existsSync(packageJsonPath);
  return packageJsonExists ? [fullPath] : [];
};

const expandWorkspacePattern =
  (rootDir: string) =>
  (pattern: string): string[] => {
    const shouldExpandGlob = hasGlobPattern(pattern);
    return shouldExpandGlob
      ? expandGlobPattern(rootDir, pattern)
      : expandDirectPattern(rootDir, pattern);
  };

const expandWorkspaces = (rootDir: string, patterns: string[]): string[] => {
  const expander = expandWorkspacePattern(rootDir);
  const expanded = patterns.map(expander);
  return expanded.reduce((acc, curr) => acc.concat(curr), []);
};

const getWorkspacePatterns = (packageJson: PackageJson): string[] => {
  const workspaces = packageJson.workspaces;
  const isWorkspacesArray = Array.isArray(workspaces);

  if (isWorkspacesArray) {
    return workspaces;
  }

  const hasPackages =
    workspaces !== undefined && workspaces.packages !== undefined;
  if (hasPackages) {
    return workspaces.packages;
  }

  return [];
};

const createScript = (
  name: string,
  command: string,
  workspace: string,
  packagePath: string,
): PackageScript => {
  const script = Object.assign(
    {},
    {
      name,
      command,
      workspace,
      packagePath,
    },
  );
  return script;
};

const extractScriptsFromPackage =
  (cwd: string) =>
  (packageJsonPath: string): PackageScript[] => {
    const packageJson = parsePackageJson(packageJsonPath);
    const hasNoScripts = !packageJson || !packageJson.scripts;

    if (hasNoScripts) return [];

    const dir = resolve(packageJsonPath, "..");
    const workspace = packageJson.name || relative(cwd, dir);
    const relativePath = relative(cwd, packageJsonPath);

    const scripts = packageJson.scripts as Record<string, string>;
    const scriptEntries = Object.entries(scripts);
    const mapper = ([name, command]: [string, string]): PackageScript =>
      createScript(name, command, workspace, relativePath);
    return scriptEntries.map(mapper);
  };

const getRootScripts = (
  cwd: string,
  rootPackageJson: PackageJson,
): PackageScript[] => {
  const hasNoScripts = !rootPackageJson.scripts;
  if (hasNoScripts) return [];

  const workspace = rootPackageJson.name || "root";
  const packagePath = relative(cwd, join(cwd, "package.json"));

  const scripts = rootPackageJson.scripts as Record<string, string>;
  const scriptEntries = Object.entries(scripts);
  const mapper = ([name, command]: [string, string]): PackageScript =>
    createScript(name, command, workspace, packagePath);
  return scriptEntries.map(mapper);
};

const getWorkspaceScripts = (
  cwd: string,
  workspaceDirs: string[],
): PackageScript[] => {
  const mapper = (dir: string): string => join(dir, "package.json");
  const packageJsonPaths = workspaceDirs.map(mapper);
  const extractor = extractScriptsFromPackage(cwd);
  const scriptsArrays = packageJsonPaths.map(extractor);
  return scriptsArrays.reduce((acc, curr) => acc.concat(curr), []);
};

const getNestedScripts = (
  cwd: string,
  rootPackageJsonPath: string,
): PackageScript[] => {
  const allPackageJsons = findAllPackageJsonFiles(cwd);
  const filter = (path: string): boolean => path !== rootPackageJsonPath;
  const nonRootPackageJsons = allPackageJsons.filter(filter);

  const extractor = extractScriptsFromPackage(cwd);
  const scriptsArrays = nonRootPackageJsons.map(extractor);
  return scriptsArrays.reduce((acc, curr) => acc.concat(curr), []);
};

export const discoverScripts = (
  cwd: string = process.cwd(),
): PackageScript[] => {
  const rootPackageJsonPath = join(cwd, "package.json");

  const rootPackageJsonExists = existsSync(rootPackageJsonPath);
  if (!rootPackageJsonExists) {
    return [];
  }

  const packageJson = parsePackageJson(rootPackageJsonPath);
  const packageJsonIsNull = !packageJson;

  if (packageJsonIsNull) {
    return [];
  }

  const rootScripts = getRootScripts(cwd, packageJson);
  const workspacePatterns = getWorkspacePatterns(packageJson);

  const hasNoWorkspacePatterns = workspacePatterns.length === 0;
  if (hasNoWorkspacePatterns) {
    const nestedScripts = getNestedScripts(cwd, rootPackageJsonPath);
    return rootScripts.concat(nestedScripts);
  }

  const workspaceDirs = expandWorkspaces(cwd, workspacePatterns);
  const workspaceScripts = getWorkspaceScripts(cwd, workspaceDirs);

  return rootScripts.concat(workspaceScripts);
};
