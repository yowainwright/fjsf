import { test, expect, mock, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";

const testDir = join(process.cwd(), "tests/fixtures/executor-test");

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

test("executeKey - should handle missing file path", async () => {
  const mockExit = mock(() => {});
  const mockWrite = mock(() => {});
  const originalExit = process.exit;
  const originalWrite = process.stdout.write;

  process.exit = mockExit as any;
  process.stdout.write = mockWrite as any;

  const { executeKey } = await import("../../src/executor.ts");

  await executeKey({ mode: "exec", filePath: "", execKey: "test" });

  expect(mockExit).toHaveBeenCalledWith(1);
  expect(mockWrite).toHaveBeenCalled();

  process.exit = originalExit;
  process.stdout.write = originalWrite;
});
