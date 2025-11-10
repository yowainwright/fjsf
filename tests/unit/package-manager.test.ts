import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  getRunCommand,
  getWorkspaceRunCommand,
  detectPackageManager,
} from "../../src/package-manager.ts";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const testDir = join(process.cwd(), "tests/fixtures/package-manager-test");

describe("getRunCommand", () => {
  it("returns correct command for npm", () => {
    expect(getRunCommand("npm")).toBe("npm run");
  });

  it("returns correct command for pnpm", () => {
    expect(getRunCommand("pnpm")).toBe("pnpm run");
  });

  it("returns correct command for yarn", () => {
    expect(getRunCommand("yarn")).toBe("yarn");
  });

  it("returns correct command for bun", () => {
    expect(getRunCommand("bun")).toBe("bun run");
  });
});

describe("getWorkspaceRunCommand", () => {
  it("returns correct workspace command for npm", () => {
    expect(getWorkspaceRunCommand("npm", "my-package")).toBe(
      "npm run --workspace my-package",
    );
  });

  it("returns correct workspace command for pnpm", () => {
    expect(getWorkspaceRunCommand("pnpm", "my-package")).toBe(
      "pnpm --filter my-package run",
    );
  });

  it("returns correct workspace command for yarn", () => {
    expect(getWorkspaceRunCommand("yarn", "my-package")).toBe(
      "yarn workspace my-package",
    );
  });

  it("returns correct workspace command for bun", () => {
    expect(getWorkspaceRunCommand("bun", "my-package")).toBe(
      "bun run --filter my-package",
    );
  });

  it("returns default command for unknown package manager", () => {
    expect(getWorkspaceRunCommand("unknown" as any, "my-package")).toBe(
      "npm run --workspace my-package",
    );
  });
});

describe("detectPackageManager", () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("detects bun from bun.lockb", () => {
    writeFileSync(join(testDir, "bun.lockb"), "");
    expect(detectPackageManager(testDir)).toBe("bun");
  });

  it("detects pnpm from pnpm-lock.yaml", () => {
    writeFileSync(join(testDir, "pnpm-lock.yaml"), "");
    expect(detectPackageManager(testDir)).toBe("pnpm");
  });

  it("detects yarn from yarn.lock", () => {
    writeFileSync(join(testDir, "yarn.lock"), "");
    expect(detectPackageManager(testDir)).toBe("yarn");
  });

  it("detects npm from package-lock.json", () => {
    writeFileSync(join(testDir, "package-lock.json"), "");
    expect(detectPackageManager(testDir)).toBe("npm");
  });

  it("defaults to npm when no lock file found", () => {
    expect(detectPackageManager(testDir)).toBe("npm");
  });

  it("prioritizes bun over other package managers", () => {
    writeFileSync(join(testDir, "bun.lockb"), "");
    writeFileSync(join(testDir, "pnpm-lock.yaml"), "");
    writeFileSync(join(testDir, "yarn.lock"), "");
    writeFileSync(join(testDir, "package-lock.json"), "");
    expect(detectPackageManager(testDir)).toBe("bun");
  });

  it("prioritizes pnpm over yarn and npm", () => {
    writeFileSync(join(testDir, "pnpm-lock.yaml"), "");
    writeFileSync(join(testDir, "yarn.lock"), "");
    writeFileSync(join(testDir, "package-lock.json"), "");
    expect(detectPackageManager(testDir)).toBe("pnpm");
  });

  it("prioritizes yarn over npm", () => {
    writeFileSync(join(testDir, "yarn.lock"), "");
    writeFileSync(join(testDir, "package-lock.json"), "");
    expect(detectPackageManager(testDir)).toBe("yarn");
  });
});
