import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { spawn } from "bun";
import { join, resolve } from "path";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";

const QJS_BINARY = join(import.meta.dir, "../../bin/fjsf-qjs");
const HAS_BINARY = existsSync(QJS_BINARY);
const TEST_DIR = resolve(import.meta.dir, ".test-fixtures");

async function runQJS(
  args: string[] = [],
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = spawn([QJS_BINARY, ...args], {
    cwd: cwd || process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    stdin: "pipe",
  });

  proc.stdin.end();

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  const exitCode = proc.exitCode || 0;

  return { stdout, stderr, exitCode };
}

async function runQJSWithInput(
  args: string[] = [],
  input: Uint8Array,
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = spawn([QJS_BINARY, ...args], {
    cwd: cwd || process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
    stdin: "pipe",
  });

  proc.stdin.write(input);
  proc.stdin.end();

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  const exitCode = proc.exitCode || 0;

  return { stdout, stderr, exitCode };
}

const CTRL_C = new Uint8Array([3]);

function createTestFixtures() {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, "packages/app-a"), { recursive: true });

  writeFileSync(
    join(TEST_DIR, "package.json"),
    JSON.stringify(
      {
        name: "test-root",
        scripts: {
          test: "echo 'test'",
          build: "echo 'build'",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(TEST_DIR, "packages/app-a/package.json"),
    JSON.stringify(
      {
        name: "@test/app-a",
        scripts: {
          dev: "echo 'dev'",
          build: "echo 'build'",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(TEST_DIR, "Cargo.toml"),
    `[package]
name = "my-crate"
version = "0.1.0"

[scripts]
build = "cargo build"
test = "cargo test"
`,
  );

  writeFileSync(
    join(TEST_DIR, "taskfile.yml"),
    `name: my-project
tasks:
  build: go build ./...
  test: go test ./...
  lint: golangci-lint run
`,
  );

  writeFileSync(join(TEST_DIR, "invalid.json"), "{ this is not valid json }");

  writeFileSync(join(TEST_DIR, "empty.json"), "");
}

function cleanupTestFixtures() {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

const describeQJS = HAS_BINARY ? describe : describe.skip;

describeQJS("QuickJS Binary Integration Tests", () => {
  beforeAll(() => {
    createTestFixtures();
  });

  afterAll(() => {
    cleanupTestFixtures();
  });

  describe("CLI flags", () => {
    test("help shows usage", async () => {
      const result = await runQJS(["help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("fjsf");
      expect(result.stdout).toContain("USAGE:");
      expect(result.stdout).toContain("find");
      expect(result.stdout).toContain("path");
    });

    test("h shows usage (short form)", async () => {
      const result = await runQJS(["h"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("USAGE:");
    });

    test("--help shows usage", async () => {
      const result = await runQJS(["--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("USAGE:");
    });

    test("-v shows version", async () => {
      const result = await runQJS(["-v"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test("--version shows version", async () => {
      const result = await runQJS(["--version"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test("quit exits cleanly", async () => {
      const result = await runQJS(["quit"]);
      expect(result.exitCode).toBe(0);
    });

    test("q exits cleanly (short form)", async () => {
      const result = await runQJS(["q"]);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("path mode", () => {
    test("reports missing file path", async () => {
      const result = await runQJS(["path"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Error");
    });

    test("reports no entries for nonexistent file", async () => {
      const result = await runQJS(["path", "nonexistent.json"], TEST_DIR);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("No entries found");
    });
  });

  describe("find mode", () => {
    test("exits with error when no matching files found", async () => {
      const result = await runQJS(["find", "no-such-file.toml"], TEST_DIR);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("No entries found");
    });

    test("finds and parses JSON scripts via Ctrl+C exit", async () => {
      const result = await runQJSWithInput(
        ["find", "package.json"],
        CTRL_C,
        TEST_DIR,
      );
      expect(result.exitCode).toBe(0);
    });

    test("finds and parses TOML scripts via Ctrl+C exit", async () => {
      const result = await runQJSWithInput(
        ["find", "Cargo.toml"],
        CTRL_C,
        TEST_DIR,
      );
      expect(result.exitCode).toBe(0);
    });

    test("finds and parses YAML tasks via Ctrl+C exit", async () => {
      const result = await runQJSWithInput(
        ["find", "taskfile.yml"],
        CTRL_C,
        TEST_DIR,
      );
      expect(result.exitCode).toBe(0);
    });
  });

  describe("startup performance", () => {
    test("starts up quickly (< 100ms avg over 5 runs)", async () => {
      const runs = 5;
      let totalDuration = 0;

      for (let i = 0; i < runs; i++) {
        const startTime = Date.now();
        await runQJS(["quit"]);
        totalDuration += Date.now() - startTime;
      }

      const avgDuration = totalDuration / runs;
      expect(avgDuration).toBeLessThan(100);
    });

    test("help command is fast (< 50ms)", async () => {
      const startTime = Date.now();
      await runQJS(["help"]);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50);
    });
  });
});
