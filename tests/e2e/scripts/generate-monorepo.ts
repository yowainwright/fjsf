#!/usr/bin/env bun

import { mkdirSync, writeFileSync, rmSync } from "fs";
import { resolve } from "path";

const TEST_WORKSPACE_DIR = resolve(process.cwd(), "tests/e2e/.test-workspace");

export const generateMonorepo = () => {
  try {
    rmSync(TEST_WORKSPACE_DIR, { recursive: true, force: true });
  } catch (error) {}

  mkdirSync(TEST_WORKSPACE_DIR, { recursive: true });
  mkdirSync(resolve(TEST_WORKSPACE_DIR, "packages/app-a"), { recursive: true });
  mkdirSync(resolve(TEST_WORKSPACE_DIR, "packages/app-b"), { recursive: true });
  mkdirSync(resolve(TEST_WORKSPACE_DIR, "packages/lib-c"), { recursive: true });
  const rootPackage = {
    name: "test-monorepo",
    private: true,
    workspaces: ["packages/*"],
    scripts: {
      test: "echo 'Running root test'",
      build: "echo 'Running root build'",
      lint: "echo 'Running root lint'",
      dev: "echo 'Running root dev'",
      clean: "echo 'Running root clean'",
    },
  };

  writeFileSync(
    resolve(TEST_WORKSPACE_DIR, "package.json"),
    JSON.stringify(rootPackage, null, 2),
  );

  const appAPackage = {
    name: "@test/app-a",
    version: "1.0.0",
    scripts: {
      dev: "echo 'Running app-a dev server'",
      build: "echo 'Building app-a'",
      test: "echo 'Testing app-a'",
      "test:unit": "echo 'Running app-a unit tests'",
      "test:e2e": "echo 'Running app-a e2e tests'",
      start: "echo 'Starting app-a'",
      lint: "echo 'Linting app-a'",
      typecheck: "echo 'Type checking app-a'",
    },
  };

  writeFileSync(
    resolve(TEST_WORKSPACE_DIR, "packages/app-a/package.json"),
    JSON.stringify(appAPackage, null, 2),
  );

  const appBPackage = {
    name: "@test/app-b",
    version: "1.0.0",
    scripts: {
      dev: "echo 'Running app-b dev server'",
      build: "echo 'Building app-b'",
      test: "echo 'Testing app-b'",
      start: "echo 'Starting app-b'",
      deploy: "echo 'Deploying app-b'",
    },
  };

  writeFileSync(
    resolve(TEST_WORKSPACE_DIR, "packages/app-b/package.json"),
    JSON.stringify(appBPackage, null, 2),
  );

  const libCPackage = {
    name: "@test/lib-c",
    version: "1.0.0",
    scripts: {
      build: "echo 'Building lib-c'",
      test: "echo 'Testing lib-c'",
      "test:watch": "echo 'Running lib-c tests in watch mode'",
    },
  };

  writeFileSync(
    resolve(TEST_WORKSPACE_DIR, "packages/lib-c/package.json"),
    JSON.stringify(libCPackage, null, 2),
  );

  console.log(`Test monorepo generated at: ${TEST_WORKSPACE_DIR}`);
  return TEST_WORKSPACE_DIR;
};

export const cleanupMonorepo = () => {
  try {
    rmSync(TEST_WORKSPACE_DIR, { recursive: true, force: true });
    console.log(`Test monorepo cleaned up: ${TEST_WORKSPACE_DIR}`);
  } catch (error) {
    console.error(`Failed to cleanup test monorepo:`, error);
  }
};

if (import.meta.main) {
  const command = process.argv[2];

  if (command === "generate") {
    generateMonorepo();
  } else if (command === "cleanup") {
    cleanupMonorepo();
  } else {
    console.log("Usage:");
    console.log("  bun tests/e2e/scripts/generate-monorepo.ts generate");
    console.log("  bun tests/e2e/scripts/generate-monorepo.ts cleanup");
  }
}
