import { existsSync } from "fs";
import { join, relative } from "path";
import { readJsonWithCache } from "../cache.ts";
import { flattenJson } from "./entry.ts";
import type { JsonEntry, JsonObject } from "./entry.ts";

const getWorkspaceName = (
  json: JsonObject,
  filePath: string,
  cwd: string,
): string => {
  const nameValue = json.name;
  const isNameString = typeof nameValue === "string";

  if (isNameString) {
    return nameValue;
  }

  const relativePath = relative(cwd, filePath);
  const isRootPackageJson = relativePath === "package.json";
  return isRootPackageJson ? "root" : relativePath;
};

const discoverJsonFile = (filePath: string, cwd: string): JsonEntry[] => {
  const json = readJsonWithCache(filePath);
  const hasNoJson = !json;

  if (hasNoJson) return [];

  const workspace = getWorkspaceName(json, filePath, cwd);
  const relativePath = relative(cwd, filePath);

  return flattenJson(json, relativePath, workspace);
};

export const discoverJsonEntries = (
  filePaths: string[],
  cwd: string = process.cwd(),
): JsonEntry[] => {
  const filter = (path: string): boolean => existsSync(path);
  const existingPaths = filePaths.filter(filter);

  const mapper = (path: string): JsonEntry[] => discoverJsonFile(path, cwd);
  const entriesArrays = existingPaths.map(mapper);

  const flattened = entriesArrays.reduce((acc, curr) => acc.concat(curr), []);
  return flattened;
};

export const discoverPackageJsonEntries = (
  packageJsonPaths: string[],
  cwd: string = process.cwd(),
): JsonEntry[] => {
  return discoverJsonEntries(packageJsonPaths, cwd);
};

const shouldSkipEntry = (entry: string): boolean => {
  const isNodeModules = entry === "node_modules";
  const isHidden = entry.startsWith(".");
  return isNodeModules || isHidden;
};

const searchDirectoryForPackageJsons = (
  dir: string,
  depth: number,
  maxDepth: number,
  results: string[],
): void => {
  const exceedsMaxDepth = depth > maxDepth;
  if (exceedsMaxDepth) return;

  const readdirSync = require("fs").readdirSync;
  const statSync = require("fs").statSync;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  const entriesLength = entries.length;
  let i = 0;

  const shouldContinue = (): boolean => i < entriesLength;

  while (shouldContinue()) {
    const entry = entries[i];
    const hasNoEntry = entry === undefined;

    if (hasNoEntry) {
      i = i + 1;
      continue;
    }

    const shouldSkip = shouldSkipEntry(entry);
    if (shouldSkip) {
      i = i + 1;
      continue;
    }

    const fullPath = join(dir, entry);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      i = i + 1;
      continue;
    }

    const isDir = stat.isDirectory();
    if (isDir) {
      const nextDepth = depth + 1;
      searchDirectoryForPackageJsons(fullPath, nextDepth, maxDepth, results);
      i = i + 1;
      continue;
    }

    const isPackageJson = entry === "package.json";
    if (isPackageJson) {
      results.push(fullPath);
    }

    i = i + 1;
  }
};

const findAllPackageJsons = (rootDir: string): string[] => {
  const results: string[] = [];
  const maxDepth = 5;
  const startDepth = 0;
  searchDirectoryForPackageJsons(rootDir, startDepth, maxDepth, results);
  return results;
};

export const discoverAllPackageJsons = (
  cwd: string = process.cwd(),
): JsonEntry[] => {
  const packageJsonPaths = findAllPackageJsons(cwd);
  return discoverPackageJsonEntries(packageJsonPaths, cwd);
};

const searchDirectoryForFile = (
  dir: string,
  fileName: string,
  depth: number,
  maxDepth: number,
  results: string[],
): void => {
  const exceedsMaxDepth = depth > maxDepth;
  if (exceedsMaxDepth) return;

  const readdirSync = require("fs").readdirSync;
  const statSync = require("fs").statSync;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  const entriesLength = entries.length;
  let i = 0;

  const shouldContinue = (): boolean => i < entriesLength;

  while (shouldContinue()) {
    const entry = entries[i];
    const hasNoEntry = entry === undefined;

    if (hasNoEntry) {
      i = i + 1;
      continue;
    }

    const shouldSkip = shouldSkipEntry(entry);
    if (shouldSkip) {
      i = i + 1;
      continue;
    }

    const fullPath = join(dir, entry);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      i = i + 1;
      continue;
    }

    const isDir = stat.isDirectory();
    if (isDir) {
      const nextDepth = depth + 1;
      searchDirectoryForFile(fullPath, fileName, nextDepth, maxDepth, results);
      i = i + 1;
      continue;
    }

    const matchesFileName = entry === fileName;
    if (matchesFileName) {
      results.push(fullPath);
    }

    i = i + 1;
  }
};

export const findAllFilesByName = (
  fileName: string,
  rootDir: string = process.cwd(),
): string[] => {
  const results: string[] = [];
  const maxDepth = 5;
  const startDepth = 0;
  searchDirectoryForFile(rootDir, fileName, startDepth, maxDepth, results);
  return results;
};

export const discoverFilesByName = (
  fileName: string,
  cwd: string = process.cwd(),
): JsonEntry[] => {
  const filePaths = findAllFilesByName(fileName, cwd);
  return discoverJsonEntries(filePaths, cwd);
};
