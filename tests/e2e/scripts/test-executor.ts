#!/usr/bin/env bun

import { spawnSync } from "child_process";
import { resolve, join } from "path";
import { writeFileSync, mkdirSync, rmSync } from "fs";

const TEST_DIR = resolve(process.cwd(), "tests/e2e/.test-executor");
const FJSF_CLI = resolve(process.cwd(), "src/cli.ts");

interface TestScenario {
  name: string;
  setup: () => void;
  args: string[];
  expectSuccess: boolean;
  description: string;
  shouldOutputContain?: string[];
}

const scenarios: TestScenario[] = [
  {
    name: "execute-simple-echo-script",
    setup: () => {
      const pkg = {
        name: "test-executor",
        scripts: {
          hello: 'echo "Hello from script"',
        },
      };
      writeFileSync(
        join(TEST_DIR, "package.json"),
        JSON.stringify(pkg, null, 2),
      );
    },
    args: ["exec", "package.json", "scripts.hello"],
    expectSuccess: true,
    description: "Execute a simple echo script",
    shouldOutputContain: ["Hello from script"],
  },
  {
    name: "execute-script-with-exit-code",
    setup: () => {
      const pkg = {
        name: "test-executor",
        scripts: {
          fail: "exit 1",
        },
      };
      writeFileSync(
        join(TEST_DIR, "package.json"),
        JSON.stringify(pkg, null, 2),
      );
    },
    args: ["exec", "package.json", "scripts.fail"],
    expectSuccess: false,
    description: "Execute a script that exits with non-zero code",
  },
  {
    name: "execute-bun-command",
    setup: () => {
      const pkg = {
        name: "test-executor",
        scripts: {
          version: "bun --version",
        },
      };
      writeFileSync(
        join(TEST_DIR, "package.json"),
        JSON.stringify(pkg, null, 2),
      );
    },
    args: ["exec", "package.json", "scripts.version"],
    expectSuccess: true,
    description: "Execute a script that runs bun command",
  },
  {
    name: "execute-multi-command-script",
    setup: () => {
      const pkg = {
        name: "test-executor",
        scripts: {
          multi: 'echo "First" && echo "Second"',
        },
      };
      writeFileSync(
        join(TEST_DIR, "package.json"),
        JSON.stringify(pkg, null, 2),
      );
    },
    args: ["exec", "package.json", "scripts.multi"],
    expectSuccess: true,
    description: "Execute a script with multiple commands",
    shouldOutputContain: ["First", "Second"],
  },
  {
    name: "execute-script-with-env-vars",
    setup: () => {
      const pkg = {
        name: "test-executor",
        scripts: {
          env: 'echo "NODE_ENV: $NODE_ENV"',
        },
      };
      writeFileSync(
        join(TEST_DIR, "package.json"),
        JSON.stringify(pkg, null, 2),
      );
    },
    args: ["exec", "package.json", "scripts.env"],
    expectSuccess: true,
    description: "Execute a script that uses environment variables",
  },
];

const setupTestDir = () => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
};

const cleanupTestDir = () => {
  rmSync(TEST_DIR, { recursive: true, force: true });
};

const runTest = (scenario: TestScenario): boolean => {
  console.log(`\nTesting: ${scenario.name}`);
  console.log(`   ${scenario.description}`);

  setupTestDir();
  scenario.setup();

  const result = spawnSync("bun", [FJSF_CLI, ...scenario.args], {
    cwd: TEST_DIR,
    encoding: "utf-8",
    stdio: "pipe",
  });

  const success = scenario.expectSuccess
    ? result.status === 0
    : result.status !== 0;

  let contentCheck = true;
  if (success && scenario.shouldOutputContain) {
    const output = (result.stdout || "") + (result.stderr || "");
    const missing = scenario.shouldOutputContain.filter(
      (item) => !output.includes(item),
    );

    if (missing.length > 0) {
      contentCheck = false;
      console.log(`   Missing expected output: ${missing.join(", ")}`);
    }
  }

  if (success && contentCheck) {
    console.log(`   PASS`);
  } else {
    console.log(`   FAIL`);
    console.log(
      `   Expected: ${scenario.expectSuccess ? "success" : "failure"}`,
    );
    console.log(`   Got exit code: ${result.status}`);
    if (result.stdout) {
      console.log(`   stdout: ${result.stdout.substring(0, 200)}`);
    }
    if (result.stderr) {
      console.log(`   stderr: ${result.stderr.substring(0, 200)}`);
    }
  }

  return success && contentCheck;
};

const runAllTests = () => {
  console.log("Running executor integration e2e tests...\n");

  const results = scenarios.map(runTest);
  const passed = results.filter(Boolean).length;
  const total = results.length;

  cleanupTestDir();

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("All executor tests passed!");
    process.exit(0);
  } else {
    console.log(`${total - passed} test(s) failed`);
    process.exit(1);
  }
};

if (import.meta.main) {
  runAllTests();
}
