import { describe, it, expect } from "bun:test";
import {
  getRunCommand,
  getWorkspaceRunCommand,
} from "../../src/package-manager.ts";

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
});
