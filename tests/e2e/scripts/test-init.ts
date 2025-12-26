#!/usr/bin/env bun

import { spawnSync } from "child_process";
import { resolve } from "path";
import { existsSync } from "fs";
import { homedir } from "os";

const TEST_WORKSPACE_DIR = resolve(process.cwd(), "tests/e2e/.test-workspace");
const FJSF_CLI = resolve(process.cwd(), "bin/fjsf-qjs");

interface TestScenario {
  name: string;
  args: string[];
  cwd: string;
  expectSuccess: boolean;
  description: string;
  checkFile?: string;
  shouldInclude?: string[];
  verifyFjsfDir?: boolean;
}

const checkOutputContent = (
  success: boolean,
  scenario: TestScenario,
  result: ReturnType<typeof spawnSync>,
): boolean => {
  const shouldCheck = success && scenario.shouldInclude;
  if (!shouldCheck) return true;

  const output = String(result.stdout || "") + String(result.stderr || "");
  const missingItems = scenario.shouldInclude!.filter(
    (item) => !output.toLowerCase().includes(item.toLowerCase()),
  );

  const hasMissingItems = missingItems.length > 0;
  if (hasMissingItems) {
    console.log(`   Missing expected items: ${missingItems.join(", ")}`);
    return false;
  }

  return true;
};

const verifyFjsfDirectory = (
  success: boolean,
  scenario: TestScenario,
): boolean => {
  const shouldVerify = success && scenario.verifyFjsfDir;
  if (!shouldVerify) return true;

  const fjsfDir = resolve(homedir(), ".fjsf");
  const shellFiles = ["init.zsh", "init.bash", "init.fish"];

  const dirExists = existsSync(fjsfDir);
  if (!dirExists) {
    console.log(`   .fjsf directory not created`);
    return false;
  }

  const hasAtLeastOneShellFile = shellFiles.some((file) =>
    existsSync(resolve(fjsfDir, file)),
  );

  if (!hasAtLeastOneShellFile) {
    console.log(`   No shell integration files created`);
    return false;
  }

  console.log(`   .fjsf directory verified`);
  return true;
};

const scenarios: TestScenario[] = [
  {
    name: "init-command",
    args: ["init"],
    cwd: TEST_WORKSPACE_DIR,
    expectSuccess: true,
    description: "Run init command to setup shell integration",
    shouldInclude: [
      "fjsf shell integration setup",
      "detected shell",
      "setup complete",
    ],
    verifyFjsfDir: true,
  },
];

const runTest = (scenario: TestScenario): boolean => {
  console.log(`\nTesting: ${scenario.name}`);
  console.log(`   ${scenario.description}`);

  const result = spawnSync(FJSF_CLI, scenario.args, {
    cwd: scenario.cwd,
    encoding: "utf-8",
    stdio: "pipe",
  });

  const success = scenario.expectSuccess
    ? result.status === 0
    : result.status !== 0;

  const contentCheck = checkOutputContent(success, scenario, result);
  const fileCheck = verifyFjsfDirectory(success, scenario);

  if (success && contentCheck && fileCheck) {
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

  return success && contentCheck && fileCheck;
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
