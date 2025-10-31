import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  renderTooltip,
  clearTooltipFinal,
} from "../../src/tooltip/renderer.ts";
import { createInitialState } from "../../src/state.ts";
import { updateQuery } from "../../src/search.ts";
import type { PackageScript } from "../../src/types.ts";

const mockScripts: PackageScript[] = [
  {
    name: "test",
    command: "bun test",
    workspace: "root",
    packagePath: "/test/package.json",
  },
  {
    name: "build",
    command: "bun build",
    workspace: "root",
    packagePath: "/test/package.json",
  },
  {
    name: "dev",
    command: "bun dev",
    workspace: "root",
    packagePath: "/test/package.json",
  },
];

describe("tooltip renderer", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("renders tooltip without errors", () => {
    const state = createInitialState(mockScripts);
    expect(() => renderTooltip(state)).not.toThrow();
  });

  it("renders tooltip with filtered results", () => {
    const state = createInitialState(mockScripts);
    const filtered = updateQuery(state, "te");
    expect(() => renderTooltip(filtered)).not.toThrow();
  });

  it("renders tooltip with no matches", () => {
    const state = createInitialState(mockScripts);
    const noMatches = updateQuery(state, "xyz");
    expect(() => renderTooltip(noMatches)).not.toThrow();
  });

  it("clears tooltip without errors", () => {
    const state = createInitialState(mockScripts);
    renderTooltip(state);
    expect(() => clearTooltipFinal()).not.toThrow();
  });

  it("handles empty scripts list", () => {
    const state = createInitialState([]);
    expect(() => renderTooltip(state)).not.toThrow();
  });

  it("handles many scripts", () => {
    const manyScripts = Array.from({ length: 20 }, (_, i) => ({
      name: `script${i}`,
      command: `command${i}`,
      workspace: "root",
      packagePath: "/test/package.json",
    }));
    const state = createInitialState(manyScripts);
    expect(() => renderTooltip(state)).not.toThrow();
  });
});
