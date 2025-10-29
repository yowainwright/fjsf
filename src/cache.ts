import { readFileSync, statSync } from "fs";
import type { JsonObject } from "./json/entry.ts";

interface CacheEntry {
  data: JsonObject;
  mtime: number;
}

const cache = new Map<string, CacheEntry>();

const getFileMtime = (filePath: string): number => {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
};

const parseJsonFile = (filePath: string): JsonObject | null => {
  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const isCacheValid = (filePath: string, cachedMtime: number): boolean => {
  const currentMtime = getFileMtime(filePath);

  const mtimeDoesNotExist = currentMtime <= 0;
  if (mtimeDoesNotExist) return false;

  return currentMtime === cachedMtime;
};

export const readJsonWithCache = (filePath: string): JsonObject | null => {
  const cached = cache.get(filePath);

  const hasCached = cached !== undefined;
  const isCachedValid = hasCached && isCacheValid(filePath, cached.mtime);

  if (isCachedValid) {
    return cached.data;
  }

  const data = parseJsonFile(filePath);
  const hasNoData = !data;

  if (hasNoData) {
    cache.delete(filePath);
    return null;
  }

  const mtime = getFileMtime(filePath);
  const entry = Object.assign({}, { data, mtime });
  cache.set(filePath, entry);

  return data;
};

export const clearCache = (): void => {
  cache.clear();
};

export const getCacheSize = (): number => cache.size;
