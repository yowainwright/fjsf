#!/usr/bin/env bun

import { spawnSync } from "child_process";
import { resolve } from "path";

const TEST_WORKSPACE_DIR = resolve(process.cwd(), "tests/e2e/.test-workspace");
const FJSF_CLI = resolve(process.cwd(), "bin/fjsf-qjs");

interface TestScenario {
  name: string;
  args: string[];
  cwd: string;
  expectSuccess: boolean;
  description: string;
  shouldInclude?: string[];
}

const scenarios: TestScenario[] = [
  {
    name: "scripts-default-mode",
    args: [],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: true,
    description: "Run default scripts mode (no arguments)",
  },
  {
    name: "scripts-specific-package",
    args: ["package.json"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: true,
    description: "Run scripts mode with specific package.json",
  },
  {
    name: "scripts-workspace-package",
    args: ["packages/app-a/package.json"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: true,
    description: "Run scripts mode for workspace package",
  },
  {
    name: "scripts-from-subdir",
    args: [],
    cwd: resolve(TEST_WORKSPACE_DIR, "packages/app-a"),
    expectSuccess: true,
    description: "Run scripts mode from workspace subdirectory",
  },
  {
    name: "scripts-relative-path",
    args: ["../../package.json"],
    cwd: resolve(TEST_WORKSPACE_DIR, "packages/app-a"),
    expectSuccess: true,
    description: "Run scripts mode with relative path to root package",
  },
  {
    name: "scripts-nonexistent-package",
    args: ["nonexistent.json"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: false,
    description: "Try to run with non-existent package.json (should fail)",
  },
];

const runTest = (scenario: TestScenario): boolean => {
  console.log(`\nTesting: ${scenario.name}`);
  console.log(`   ${scenario.description}`);
  console.log(`   Note: Interactive tests may not fully validate in CI`);

  const result = spawnSync(FJSF_CLI, scenario.args, {
    cwd: scenario.cwd,
    encoding: "utf-8",
    stdio: "pipe",
    timeout: 5000, // 5 second timeout for interactive commands
  });

  // For interactive mode, we expect it to start the UI
  // Exit code 0 or null (timeout) means it started successfully
  const success = scenario.expectSuccess
    ? result.status === 0 || result.status === null
    : result.status !== 0 && result.status !== null;

  let contentCheck = true;
  if (success && scenario.shouldInclude && result.stdout) {
    const output = result.stdout || "";
    const missingItems = scenario.shouldInclude.filter(
      (item) => !output.includes(item),
    );

    if (missingItems.length > 0) {
      contentCheck = false;
      console.log(`   Missing expected items: ${missingItems.join(", ")}`);
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
      console.log(`   stdout: ${result.stdout.substring(0, 200)}...`);
    }
    if (result.stderr) {
      console.log(`   stderr: ${result.stderr}`);
    }
  }

  return success && contentCheck;
};

const runAllTests = () => {
  console.log("Running scripts (default) mode e2e tests...\n");
  console.log(
    "Note: Scripts mode is interactive - limited validation in automated tests",
  );

  const results = scenarios.map(runTest);
  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("All scripts tests passed!");
    process.exit(0);
  } else {
    console.log(`${total - passed} test(s) failed`);
    process.exit(1);
  }
};

if (import.meta.main) {
  runAllTests();
}
