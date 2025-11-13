#!/usr/bin/env bun

import { spawnSync } from "child_process";
import { resolve } from "path";
import { writeFileSync, existsSync } from "fs";
import { homedir } from "os";

const FJSF_CLI = resolve(process.cwd(), "src/cli.ts");

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

const addResult = (name: string, passed: boolean, message: string = "") => {
  results.push({ name, passed, message });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`${status}: ${name}`);
  if (message && !passed) {
    console.log(`  ${message}`);
  }
};

// Test 1: Verify fjsf --completions output format
const testCompletionsOutput = () => {
  console.log("\n=== Test 1: Completions Output Format ===");

  const result = spawnSync("bun", [FJSF_CLI, "--completions"], {
    encoding: "utf-8",
    stdio: "pipe",
  });

  const hasOutput = result.stdout.length > 0;
  addResult(
    "Completions produce output",
    hasOutput,
    hasOutput ? "" : "No output from --completions",
  );

  if (!hasOutput) return;

  const lines = result.stdout.split("\n").filter((line) => line.length > 0);
  const allHaveColonFormat = lines.every((line) => line.includes(":"));
  addResult(
    "All completion lines have colon format (name:description)",
    allHaveColonFormat,
    allHaveColonFormat
      ? ""
      : `Found lines without colon: ${lines.filter((l) => !l.includes(":")).join(", ")}`,
  );

  // Check for specific scripts we know should exist
  const hasDevScript = result.stdout.includes("dev:");
  const hasTestScript = result.stdout.includes("test:");
  addResult("Contains dev script", hasDevScript);
  addResult("Contains test script", hasTestScript);
};

// Test 2: Initialize fjsf with native mode
const testInitNativeMode = () => {
  console.log("\n=== Test 2: Initialize Native Mode ===");

  const result = spawnSync("bun", [FJSF_CLI, "init", "--native"], {
    encoding: "utf-8",
    stdio: "pipe",
    env: { ...process.env, SHELL: "/bin/zsh" },
  });

  const success = result.status === 0;
  addResult("Init command succeeds with --native flag", success, result.stderr);

  if (!success) return;

  const fjsfDir = resolve(homedir(), ".fjsf");
  const initFile = resolve(fjsfDir, "init.zsh");

  const dirExists = existsSync(fjsfDir);
  const fileExists = existsSync(initFile);

  addResult("Creates .fjsf directory", dirExists);
  addResult("Creates init.zsh file", fileExists);
};

// Test 3: Test the native completion function directly
const testNativeCompletionFunction = () => {
  console.log("\n=== Test 3: Native Completion Function ===");

  // Create a test zsh script
  const fjsfDir = resolve(homedir(), ".fjsf");
  const initFile = resolve(fjsfDir, "init.zsh");

  const isInitFilePresent = existsSync(initFile);
  if (!isInitFilePresent) {
    addResult(
      "Native completion function test",
      false,
      "init.zsh not found, skipping",
    );
    return;
  }

  // Create a test script that simulates zsh completion
  const testScript = `
#!/bin/zsh
source ${initFile}

# Simulate the zsh completion context
typeset -a words
words=(bun run test)
CURRENT=3

# Call the completion function
_fjsf_native_bun_run

# Check if we got completions
if (( \${#_describe_called} > 0 )); then
  echo "COMPLETION_SUCCESS"
fi
`;

  const scriptPath = resolve("/tmp", "test-completion.zsh");
  writeFileSync(scriptPath, testScript);

  const checkResult = spawnSync(
    "zsh",
    [
      "-c",
      `source ${initFile} && type _fjsf_native_bun_run | grep -q "function"`,
    ],
    {
      encoding: "utf-8",
      stdio: "pipe",
    },
  );

  const functionExists = checkResult.status === 0;
  addResult(
    "Native completion function exists",
    functionExists,
    functionExists ? "" : checkResult.stderr,
  );
};

// Test 4: Verify completion function registration
const testCompletionRegistration = () => {
  console.log("\n=== Test 4: Completion Function Registration ===");

  const fjsfDir = resolve(homedir(), ".fjsf");
  const initFile = resolve(fjsfDir, "init.zsh");

  const isInitFilePresent = existsSync(initFile);
  if (!isInitFilePresent) {
    addResult(
      "Completion registration test",
      false,
      "init.zsh not found, skipping",
    );
    return;
  }

  // Check if compdef commands are present in the init file
  const checkCompdef = spawnSync("grep", ["-c", "compdef", initFile], {
    encoding: "utf-8",
    stdio: "pipe",
  });

  const hasCompdefs =
    checkCompdef.status === 0 && parseInt(checkCompdef.stdout) >= 4;
  addResult(
    "Init file contains compdef registrations (4 package managers)",
    hasCompdefs,
    hasCompdefs ? "" : `Expected 4 compdefs, found: ${checkCompdef.stdout}`,
  );

  // Check for dynamic completion lookup function
  const checkDynamicLookup = spawnSync(
    "grep",
    ["-c", "_fjsf_get_original_completion", initFile],
    {
      encoding: "utf-8",
      stdio: "pipe",
    },
  );

  const hasDynamicLookup =
    checkDynamicLookup.status === 0 && parseInt(checkDynamicLookup.stdout) >= 1;
  addResult(
    "Init file has dynamic completion lookup",
    hasDynamicLookup,
    hasDynamicLookup
      ? ""
      : `Expected dynamic lookup function, found: ${checkDynamicLookup.stdout}`,
  );
};

// Test 5: Test with actual zsh completion system
const testZshCompletionSystem = () => {
  console.log("\n=== Test 5: Zsh Completion System Integration ===");

  const fjsfDir = resolve(homedir(), ".fjsf");
  const initFile = resolve(fjsfDir, "init.zsh");

  const isInitFilePresent = existsSync(initFile);
  if (!isInitFilePresent) {
    addResult(
      "Zsh completion system test",
      false,
      "init.zsh not found, skipping",
    );
    return;
  }

  // Test script that actually triggers the completion
  const testScript = `#!/bin/zsh
autoload -Uz compinit
compinit

source ${initFile}

# Set up the completion context
setopt interactivecomments
setopt NO_NOMATCH

# Simulate typing "bun run " and requesting completions
print -z "bun run "

# Get completions programmatically
typeset -a reply
reply=(\${(f)"\$(bun ${FJSF_CLI} --completions 2>/dev/null)"})

if (( \${#reply} > 0 )); then
  echo "GOT_COMPLETIONS:\${#reply}"
  echo "\${reply[1]}"
else
  echo "NO_COMPLETIONS"
fi
`;

  const scriptPath = resolve("/tmp", "test-zsh-completion.zsh");
  writeFileSync(scriptPath, testScript);

  const result = spawnSync("zsh", [scriptPath], {
    encoding: "utf-8",
    stdio: "pipe",
  });

  const hasCompletions = result.stdout.includes("GOT_COMPLETIONS");
  addResult(
    "Zsh can retrieve completions via fjsf",
    hasCompletions,
    hasCompletions ? "" : `Output: ${result.stdout}\nError: ${result.stderr}`,
  );
};

// Test 6: Test fuzzy filtering in completions
const testFuzzyFiltering = () => {
  console.log("\n=== Test 6: Fuzzy Filtering ===");

  const result = spawnSync("bun", [FJSF_CLI, "--completions", "bld"], {
    encoding: "utf-8",
    stdio: "pipe",
  });

  const hasBuildInOutput = result.stdout.includes("build");
  addResult(
    'Fuzzy filtering works (query "bld" matches "build")',
    hasBuildInOutput,
    hasBuildInOutput ? "" : `Output: ${result.stdout}`,
  );
};

// Run all tests
const runAllTests = () => {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  fjsf Completions E2E Tests             ║");
  console.log("╚══════════════════════════════════════════╝\n");

  testCompletionsOutput();
  testInitNativeMode();
  testNativeCompletionFunction();
  testCompletionRegistration();
  testZshCompletionSystem();
  testFuzzyFiltering();

  // Summary
  console.log("\n" + "=".repeat(50));
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  console.log(`\n📊 Results: ${passed}/${total} tests passed\n`);

  const failedTests = results.filter((r) => !r.passed);
  if (failedTests.length > 0) {
    console.log("Failed tests:");
    failedTests.forEach((test) => {
      console.log(`  ✗ ${test.name}`);
      if (test.message) {
        console.log(`    ${test.message}`);
      }
    });
  }

  if (passed === total) {
    console.log("✅ All completions tests passed!");
    process.exit(0);
  } else {
    console.log(`❌ ${total - passed} test(s) failed`);
    process.exit(1);
  }
};

if (import.meta.main) {
  runAllTests();
}
