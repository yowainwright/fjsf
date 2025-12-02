import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, utimesSync } from "fs";
import { join } from "path";
import {
  readJsonWithCache,
  clearCache,
  getCacheSize,
} from "../../src/cache.ts";

const TEST_DIR = join(process.cwd(), "test-cache-fixtures");

const cleanup = () => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  clearCache();
};

const setup = () => {
  cleanup();
  mkdirSync(TEST_DIR, { recursive: true });
};

describe("cache", () => {
  beforeEach(setup);
  afterEach(cleanup);

  describe("readJsonWithCache", () => {
    it("reads and caches JSON file", () => {
      const filePath = join(TEST_DIR, "test.json");
      const data = { name: "test", version: "1.0.0" };

      writeFileSync(filePath, JSON.stringify(data));

      const result = readJsonWithCache(filePath);

      expect(result).toEqual(data);
      expect(getCacheSize()).toBe(1);
    });

    it("returns cached data on subsequent reads", () => {
      const filePath = join(TEST_DIR, "test.json");
      const data = { name: "test" };

      writeFileSync(filePath, JSON.stringify(data));

      const first = readJsonWithCache(filePath);
      const second = readJsonWithCache(filePath);

      expect(first).toEqual(second);
      expect(getCacheSize()).toBe(1);
    });

    it("invalidates cache when file is modified", async () => {
      const filePath = join(TEST_DIR, "test.json");
      const data1 = { version: "1.0.0" };
      const data2 = { version: "2.0.0" };

      writeFileSync(filePath, JSON.stringify(data1));
      const first = readJsonWithCache(filePath);

      await new Promise((resolve) => setTimeout(resolve, 10));

      writeFileSync(filePath, JSON.stringify(data2));
      const futureTime = Date.now() + 1000;
      utimesSync(filePath, new Date(futureTime), new Date(futureTime));

      const second = readJsonWithCache(filePath);

      expect(first).toEqual(data1);
      expect(second).toEqual(data2);
    });

    it("returns null for invalid JSON", () => {
      const filePath = join(TEST_DIR, "invalid.json");
      writeFileSync(filePath, "not valid json");

      const result = readJsonWithCache(filePath);

      expect(result).toBeNull();
    });

    it("returns null for non-existent file", () => {
      const result = readJsonWithCache(join(TEST_DIR, "nonexistent.json"));
      expect(result).toBeNull();
    });

    it("removes cached entry when file becomes invalid", () => {
      const filePath = join(TEST_DIR, "test.json");
      const data = { name: "test" };

      // First, create and cache valid JSON
      writeFileSync(filePath, JSON.stringify(data));
      readJsonWithCache(filePath);
      expect(getCacheSize()).toBe(1);

      // Now delete the file and try to read again
      rmSync(filePath);
      const result = readJsonWithCache(filePath);

      expect(result).toBeNull();
      expect(getCacheSize()).toBe(0);
    });
  });

  describe("clearCache", () => {
    it("clears all cached entries", () => {
      const file1 = join(TEST_DIR, "file1.json");
      const file2 = join(TEST_DIR, "file2.json");

      writeFileSync(file1, JSON.stringify({ a: 1 }));
      writeFileSync(file2, JSON.stringify({ b: 2 }));

      readJsonWithCache(file1);
      readJsonWithCache(file2);

      expect(getCacheSize()).toBe(2);

      clearCache();

      expect(getCacheSize()).toBe(0);
    });
  });
});
