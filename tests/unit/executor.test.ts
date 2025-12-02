import { expect, mock, beforeEach, afterEach, describe, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  isRootScript,
  getNestedValue,
  executeKey,
  buildCommand,
} from "../../src/executor.ts";

const testDir = join(process.cwd(), "tests/fixtures/executor-test");

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("buildCommand", () => {
  it("builds command for root script using run command", () => {
    const script = {
      name: "test",
      command: "jest",
      workspace: "root",
      packagePath: "package.json",
    };
    // Uses process.cwd() to detect package manager
    const command = buildCommand(script, process.cwd());
    expect(command).toContain("run test");
  });

  it("builds command for workspace script using workspace command", () => {
    const script = {
      name: "build",
      command: "tsc",
      workspace: "@app/core",
      packagePath: "packages/core/package.json",
    };
    const command = buildCommand(script, process.cwd());
    // Workspace commands include --filter or -w depending on package manager
    expect(command).toContain("build");
  });
});

describe("isRootScript", () => {
  it("returns true for root workspace", () => {
    const script = {
      name: "test",
      command: "jest",
      workspace: "root",
      packagePath: "packages/foo/package.json",
    };
    expect(isRootScript(script)).toBe(true);
  });

  it("returns true for package.json path", () => {
    const script = {
      name: "test",
      command: "jest",
      workspace: "@app/core",
      packagePath: "package.json",
    };
    expect(isRootScript(script)).toBe(true);
  });

  it("returns false for non-root workspace", () => {
    const script = {
      name: "test",
      command: "jest",
      workspace: "@app/core",
      packagePath: "packages/core/package.json",
    };
    expect(isRootScript(script)).toBe(false);
  });
});

describe("getNestedValue", () => {
  it("returns value for simple key", () => {
    const obj = { name: "test" };
    expect(getNestedValue(obj, "name")).toBe("test");
  });

  it("returns value for nested key", () => {
    const obj = { scripts: { test: "jest", build: "tsc" } };
    expect(getNestedValue(obj, "scripts.test")).toBe("jest");
    expect(getNestedValue(obj, "scripts.build")).toBe("tsc");
  });

  it("returns value for deeply nested key", () => {
    const obj = { a: { b: { c: { d: "deep" } } } };
    expect(getNestedValue(obj, "a.b.c.d")).toBe("deep");
  });

  it("returns undefined for missing key", () => {
    const obj = { name: "test" };
    expect(getNestedValue(obj, "missing")).toBeUndefined();
  });

  it("returns undefined for missing nested key", () => {
    const obj = { a: { b: "value" } };
    expect(getNestedValue(obj, "a.c.d")).toBeUndefined();
  });

  it("returns undefined for null object", () => {
    expect(getNestedValue(null, "key")).toBeUndefined();
  });

  it("returns undefined for undefined object", () => {
    expect(getNestedValue(undefined, "key")).toBeUndefined();
  });

  it("handles numeric values", () => {
    const obj = { count: 42, nested: { value: 100 } };
    expect(getNestedValue(obj, "count")).toBe(42);
    expect(getNestedValue(obj, "nested.value")).toBe(100);
  });

  it("handles boolean values", () => {
    const obj = { enabled: true, nested: { active: false } };
    expect(getNestedValue(obj, "enabled")).toBe(true);
    expect(getNestedValue(obj, "nested.active")).toBe(false);
  });

  it("handles array values", () => {
    const obj = { items: [1, 2, 3] };
    expect(getNestedValue(obj, "items")).toEqual([1, 2, 3]);
  });

  it("handles object values", () => {
    const obj = { config: { key: "value" } };
    expect(getNestedValue(obj, "config")).toEqual({ key: "value" });
  });
});

describe("executeKey", () => {
  it("should handle missing file path", async () => {
    const mockExit = mock(() => {});
    const mockWrite = mock(() => {});
    const originalExit = process.exit;
    const originalWrite = process.stdout.write;

    process.exit = mockExit as any;
    process.stdout.write = mockWrite as any;

    await executeKey({ mode: "exec", filePath: "", execKey: "test" });

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockWrite).toHaveBeenCalled();

    process.exit = originalExit;
    process.stdout.write = originalWrite;
  });

  it("should handle missing exec key", async () => {
    const mockExit = mock(() => {});
    const mockWrite = mock(() => {});
    const originalExit = process.exit;
    const originalWrite = process.stdout.write;

    process.exit = mockExit as any;
    process.stdout.write = mockWrite as any;

    await executeKey({ mode: "exec", filePath: "package.json", execKey: "" });

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockWrite).toHaveBeenCalled();

    process.exit = originalExit;
    process.stdout.write = originalWrite;
  });

  it("should handle non-existent file", async () => {
    const mockExit = mock(() => {});
    const mockWrite = mock(() => {});
    const originalExit = process.exit;
    const originalWrite = process.stdout.write;

    process.exit = mockExit as any;
    process.stdout.write = mockWrite as any;

    await executeKey({
      mode: "exec",
      filePath: "nonexistent.json",
      execKey: "scripts.test",
    });

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockWrite).toHaveBeenCalled();

    process.exit = originalExit;
    process.stdout.write = originalWrite;
  });

  it("should handle missing key in file", async () => {
    const mockExit = mock(() => {});
    const mockWrite = mock(() => {});
    const originalExit = process.exit;
    const originalWrite = process.stdout.write;

    const testFile = join(testDir, "package.json");
    writeFileSync(testFile, JSON.stringify({ name: "test" }));

    process.exit = mockExit as any;
    process.stdout.write = mockWrite as any;

    await executeKey({
      mode: "exec",
      filePath: testFile,
      execKey: "scripts.test",
    });

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockWrite).toHaveBeenCalled();

    process.exit = originalExit;
    process.stdout.write = originalWrite;
  });

  it("should handle non-string value", async () => {
    const mockExit = mock(() => {});
    const mockWrite = mock(() => {});
    const originalExit = process.exit;
    const originalWrite = process.stdout.write;

    const testFile = join(testDir, "package.json");
    writeFileSync(testFile, JSON.stringify({ scripts: { test: 123 } }));

    process.exit = mockExit as any;
    process.stdout.write = mockWrite as any;

    await executeKey({
      mode: "exec",
      filePath: testFile,
      execKey: "scripts.test",
    });

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockWrite).toHaveBeenCalled();

    process.exit = originalExit;
    process.stdout.write = originalWrite;
  });

  it("should handle non-script key", async () => {
    const mockExit = mock(() => {});
    const mockWrite = mock(() => {});
    const originalExit = process.exit;
    const originalWrite = process.stdout.write;

    const testFile = join(testDir, "package.json");
    writeFileSync(testFile, JSON.stringify({ name: "test-package" }));

    process.exit = mockExit as any;
    process.stdout.write = mockWrite as any;

    await executeKey({
      mode: "exec",
      filePath: testFile,
      execKey: "name",
    });

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(mockWrite).toHaveBeenCalled();

    process.exit = originalExit;
    process.stdout.write = originalWrite;
  });
});
