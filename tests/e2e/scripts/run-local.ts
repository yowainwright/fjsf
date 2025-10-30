#!/usr/bin/env bun

import { spawnSync } from "child_process";
import { resolve } from "path";
import { generateMonorepo, cleanupMonorepo } from "./generate-monorepo.ts";

const SCRIPTS_DIR = resolve(process.cwd(), "tests/e2e/scripts");

const testScripts = [
  "test-exec.ts",
  "test-list.ts",
  "test-run.ts",
  "test-find.ts",
  "test-init.ts",
  "test-path.ts",
  "test-scripts.ts",
];

const runTest = (scriptName: string): boolean => {
  console.log(`\nRunning ${scriptName}...`);
  const scriptPath = resolve(SCRIPTS_DIR, scriptName);

  const result = spawnSync("bun", [scriptPath], {
    stdio: "inherit",
    encoding: "utf-8",
  });

  return result.status === 0;
};

const runAllTests = () => {
  console.log("Setting up test workspace...");
  generateMonorepo();

  console.log("\n" + "=".repeat(50));
  console.log("Running all e2e tests locally...");
  console.log("=".repeat(50));

  const results = testScripts.map(runTest);
  const passed = results.filter(Boolean).length;
  const total = results.length;

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed}/${total} tests passed`);
  console.log("=".repeat(50));

  console.log("\nCleaning up test workspace...");
  cleanupMonorepo();

  if (passed === total) {
    console.log("\nAll e2e tests passed!");
    process.exit(0);
  } else {
    console.log(`\n${total - passed} test suite(s) failed`);
    process.exit(1);
  }
};

if (import.meta.main) {
  const specificTest = process.argv[2];

  if (specificTest) {
    console.log("Setting up test workspace...");
    generateMonorepo();

    const testFile = specificTest.endsWith(".ts")
      ? specificTest
      : `test-${specificTest}.ts`;

    if (testScripts.includes(testFile)) {
      const success = runTest(testFile);
      cleanupMonorepo();
      process.exit(success ? 0 : 1);
    } else {
      console.error(`Unknown test: ${specificTest}`);
      console.log(`Available tests: ${testScripts.join(", ")}`);
      process.exit(1);
    }
  } else {
    runAllTests();
  }
}
