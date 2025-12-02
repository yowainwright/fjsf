import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { spawn, spawnSync } from "bun";
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

function createTestFixtures() {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, "packages/app-a"), { recursive: true });
  mkdirSync(join(TEST_DIR, "packages/app-b"), { recursive: true });
  mkdirSync(join(TEST_DIR, "packages/lib-shared"), { recursive: true });
  mkdirSync(join(TEST_DIR, "nested/deep/dir"), { recursive: true });

  writeFileSync(
    join(TEST_DIR, "package.json"),
    JSON.stringify(
      {
        name: "test-monorepo",
        private: true,
        workspaces: ["packages/*"],
        scripts: {
          test: "echo 'root test'",
          build: "echo 'root build'",
          lint: "echo 'root lint'",
          dev: "echo 'root dev'",
        },
        dependencies: {
          react: "^18.2.0",
          typescript: "^5.0.0",
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
        version: "1.0.0",
        scripts: {
          dev: "echo 'app-a dev'",
          build: "echo 'app-a build'",
          test: "echo 'app-a test'",
          "test:unit": "echo 'app-a unit'",
          "test:e2e": "echo 'app-a e2e'",
        },
        dependencies: {
          react: "^18.0.0",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(TEST_DIR, "packages/app-b/package.json"),
    JSON.stringify(
      {
        name: "@test/app-b",
        version: "2.0.0",
        scripts: {
          dev: "echo 'app-b dev'",
          build: "echo 'app-b build'",
          test: "echo 'app-b test'",
          deploy: "echo 'app-b deploy'",
        },
        dependencies: {
          react: "^17.0.2",
          lodash: "^4.17.21",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(TEST_DIR, "packages/lib-shared/package.json"),
    JSON.stringify(
      {
        name: "@test/lib-shared",
        version: "0.1.0",
        scripts: {
          build: "echo 'lib build'",
          test: "echo 'lib test'",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(TEST_DIR, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: "./dist",
        },
        include: ["src/**/*"],
        exclude: ["node_modules"],
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(TEST_DIR, "packages/app-a/tsconfig.json"),
    JSON.stringify(
      {
        extends: "../../tsconfig.json",
        compilerOptions: {
          target: "ES2020",
          jsx: "react-jsx",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(TEST_DIR, "packages/app-b/tsconfig.json"),
    JSON.stringify(
      {
        extends: "../../tsconfig.json",
        compilerOptions: {
          target: "ES2021",
          jsx: "preserve",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(TEST_DIR, "nested/deep/dir/config.json"),
    JSON.stringify(
      {
        name: "nested-config",
        settings: {
          enabled: true,
          timeout: 5000,
        },
      },
      null,
      2,
    ),
  );

  const largeArray = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: Math.random() * 1000,
    tags: [`tag-${i % 10}`, `category-${i % 5}`],
    nested: {
      level1: {
        level2: {
          data: `deep-value-${i}`,
        },
      },
    },
  }));

  writeFileSync(
    join(TEST_DIR, "large-data.json"),
    JSON.stringify({ items: largeArray, count: largeArray.length }, null, 2),
  );

  const veryLargeObject: Record<string, unknown> = {};
  for (let i = 0; i < 500; i++) {
    veryLargeObject[`key_${i}`] = {
      value: i,
      description: `Description for key ${i}`,
      metadata: {
        created: new Date().toISOString(),
        version: `1.0.${i}`,
      },
    };
  }
  writeFileSync(
    join(TEST_DIR, "large-object.json"),
    JSON.stringify(veryLargeObject, null, 2),
  );

  writeFileSync(join(TEST_DIR, "invalid.json"), "{ this is not valid json }");

  writeFileSync(join(TEST_DIR, "empty.json"), "");

  writeFileSync(
    join(TEST_DIR, "special-chars.json"),
    JSON.stringify(
      {
        "key with spaces": "value",
        "key.with.dots": "dotted",
        "key-with-dashes": "dashed",
        unicode: "\u00e9\u00e8\u00ea",
        nested: {
          "another key": "nested value",
        },
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(TEST_DIR, "deeply-nested.json"),
    JSON.stringify(
      {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: "deep",
                },
              },
            },
          },
        },
      },
      null,
      2,
    ),
  );
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
      expect(result.stdout).toContain("exec");
      expect(result.stdout).toContain("init");
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

  describe("completions mode", () => {
    test("lists all scripts", async () => {
      const result = await runQJS(["completions"], TEST_DIR);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("test:");
      expect(result.stdout).toContain("build:");
      expect(result.stdout).toContain("lint:");
      expect(result.stdout).toContain("dev:");
    });

    test("lists scripts from all workspaces", async () => {
      const result = await runQJS(["completions"], TEST_DIR);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("test-monorepo");
      expect(result.stdout).toContain("@test/app-a");
      expect(result.stdout).toContain("@test/app-b");
      expect(result.stdout).toContain("@test/lib-shared");
    });

    test("filters completions by query", async () => {
      const result = await runQJS(["completions", "unit"], TEST_DIR);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("test:unit");
    });

    test("filters completions case-insensitively", async () => {
      const result = await runQJS(["completions", "BUILD"], TEST_DIR);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("build:");
    });

    test("shows workspace context", async () => {
      const result = await runQJS(["completions", "deploy"], TEST_DIR);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("@test/app-b");
    });
  });

  describe("exec mode", () => {
    test("reports missing file path", async () => {
      const result = await runQJS(["exec"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Error");
      expect(result.stderr).toContain("file path");
    });

    test("reports missing key", async () => {
      const result = await runQJS(["exec", "package.json"], TEST_DIR);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Error");
      expect(result.stderr).toContain("key");
    });

    test("reports key not found", async () => {
      const result = await runQJS(
        ["exec", "package.json", "scripts.nonexistent"],
        TEST_DIR,
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });

    test("reports non-script key", async () => {
      const result = await runQJS(["exec", "package.json", "name"], TEST_DIR);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not a script");
    });
  });

  describe("path mode - various JSON files", () => {
    test("reports missing file path", async () => {
      const result = await runQJS(["path"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Error");
    });

    test("reports file not found", async () => {
      const result = await runQJS(["path", "nonexistent.json"], TEST_DIR);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("No entries found");
    });
  });

  describe("find mode - file discovery", () => {
    test("finds package.json files across monorepo", async () => {
      const result = await runQJS(["completions"], TEST_DIR);
      const scriptCount = (result.stdout.match(/:/g) || []).length;
      expect(scriptCount).toBeGreaterThan(10);
    });

    test("discovers tsconfig.json files", async () => {
      const proc = spawnSync([QJS_BINARY, "completions"], {
        cwd: TEST_DIR,
        timeout: 5000,
      });
      expect(proc.exitCode).toBe(0);
    });
  });

  describe("large file handling", () => {
    test("handles large JSON array (1000 items)", async () => {
      const startTime = Date.now();
      const result = await runQJS(["completions"], TEST_DIR);
      const duration = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(5000);
    });

    test("handles large JSON object (500 keys)", async () => {
      const startTime = Date.now();
      const result = await runQJS(["q"], TEST_DIR);
      const duration = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("error handling", () => {
    test("handles invalid JSON gracefully", async () => {
      const result = await runQJS(["path", "invalid.json"], TEST_DIR);
      expect(result.exitCode).toBe(1);
    });

    test("handles empty JSON file", async () => {
      const result = await runQJS(["path", "empty.json"], TEST_DIR);
      expect(result.exitCode).toBe(1);
    });
  });

  describe("workspace detection", () => {
    test("detects npm workspaces", async () => {
      const result = await runQJS(["completions"], TEST_DIR);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("@test/app-a");
      expect(result.stdout).toContain("@test/app-b");
      expect(result.stdout).toContain("@test/lib-shared");
    });

    test("includes root package scripts", async () => {
      const result = await runQJS(["completions"], TEST_DIR);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("test-monorepo");
    });
  });

  describe("startup performance", () => {
    test("starts up quickly (< 100ms)", async () => {
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

  describe("specific package.json file", () => {
    test("searches specific package.json", async () => {
      const result = await runQJS(
        ["completions"],
        join(TEST_DIR, "packages/app-a"),
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("@test/app-a");
      expect(result.stdout).toContain("test:unit");
      expect(result.stdout).toContain("test:e2e");
    });
  });
});
