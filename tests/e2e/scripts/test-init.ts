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
  checkFile?: string;
  shouldInclude?: string[];
}

const scenarios: TestScenario[] = [
  {
    name: "init-command",
    args: ["init"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: true,
    description: "Run init command to setup shell integration",
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

  let contentCheck = true;
  if (success && scenario.shouldInclude) {
    const output = (result.stdout || "") + (result.stderr || "");
    const missingItems = scenario.shouldInclude.filter(
      (item) => !output.toLowerCase().includes(item.toLowerCase()),
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
      console.log(`   stdout: ${result.stdout.substring(0, 300)}...`);
    }
    if (result.stderr) {
      console.log(`   stderr: ${result.stderr}`);
    }
  }

  return success && contentCheck;
};

const runAllTests = () => {
  console.log("Running init command e2e tests...\n");

  const results = scenarios.map(runTest);
  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("All init tests passed!");
    process.exit(0);
  } else {
    console.log(`${total - passed} test(s) failed`);
    process.exit(1);
  }
};

if (import.meta.main) {
  runAllTests();
}
