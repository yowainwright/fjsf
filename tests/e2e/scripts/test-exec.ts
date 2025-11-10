#!/usr/bin/env bun

import { spawnSync } from "child_process";
import { resolve } from "path";

const TEST_WORKSPACE_DIR = resolve(process.cwd(), "tests/e2e/.test-workspace");
const FJSF_CLI = resolve(process.cwd(), "src/cli.ts");

interface TestScenario {
  name: string;
  args: string[];
  cwd: string;
  expectSuccess: boolean;
  description: string;
}

const scenarios: TestScenario[] = [
  {
    name: "exec-root-script",
    args: ["exec", "package.json", "scripts.test"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: true,
    description: "Execute a root-level script",
  },
  {
    name: "exec-workspace-script",
    args: ["exec", "packages/app-a/package.json", "scripts.dev"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: true,
    description: "Execute a workspace-level script",
  },
  {
    name: "exec-nonexistent-script",
    args: ["exec", "package.json", "scripts.nonexistent"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: false,
    description: "Try to execute non-existent script (should fail)",
  },
  {
    name: "exec-non-script-key",
    args: ["exec", "package.json", "name"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: false,
    description: "Try to execute non-script key (should fail)",
  },
  {
    name: "exec-nested-script",
    args: ["exec", "packages/app-a/package.json", "scripts.test:unit"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: true,
    description: "Execute a script with colon in name",
  },
  {
    name: "exec-from-subdirectory",
    args: ["exec", "../../package.json", "scripts.build"],
    cwd: resolve(TEST_WORKSPACE_DIR, "packages/app-a"),
    expectSuccess: true,
    description: "Execute root script from subdirectory",
  },
  {
    name: "exec-missing-file",
    args: ["exec", "nonexistent.json", "scripts.test"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: false,
    description: "Try to execute from non-existent file (should fail)",
  },
  {
    name: "exec-without-filepath",
    args: ["exec"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: false,
    description: "Try to execute without file path (should fail)",
  },
  {
    name: "exec-without-key",
    args: ["exec", "package.json"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: false,
    description: "Try to execute without key (should fail)",
  },
  {
    name: "exec-invalid-json",
    args: ["exec", "../invalid.json", "scripts.test"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: false,
    description: "Try to execute from invalid JSON file (should fail)",
  },
  {
    name: "exec-shorthand",
    args: ["e", "package.json", "scripts.build"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: true,
    description: "Execute using shorthand 'e' command",
  },
];

const runTest = (scenario: TestScenario): boolean => {
  console.log(`\nTesting: ${scenario.name}`);
  console.log(`   ${scenario.description}`);

  const result = spawnSync("bun", [FJSF_CLI, ...scenario.args], {
    cwd: scenario.cwd,
    encoding: "utf-8",
    stdio: "pipe",
  });

  const success = scenario.expectSuccess
    ? result.status === 0
    : result.status !== 0;

  if (success) {
    console.log(`   PASS`);
  } else {
    console.log(`   FAIL`);
    console.log(
      `   Expected: ${scenario.expectSuccess ? "success" : "failure"}`,
    );
    console.log(`   Got exit code: ${result.status}`);
    if (result.stdout) {
      console.log(`   stdout: ${result.stdout}`);
    }
    if (result.stderr) {
      console.log(`   stderr: ${result.stderr}`);
    }
  }

  return success;
};

const runAllTests = () => {
  console.log("Running exec command e2e tests...\n");

  const results = scenarios.map(runTest);
  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("All exec tests passed!");
    process.exit(0);
  } else {
    console.log(`${total - passed} test(s) failed`);
    process.exit(1);
  }
};

if (import.meta.main) {
  runAllTests();
}
