import { describe, it, expect } from "bun:test";
import {
  createInitialState,
  updateSelection,
  getSelectedScript,
} from "../src/state.ts";
import type { PackageScript } from "../src/types.ts";

describe("state", () => {
  const mockScripts: PackageScript[] = [
    {
      name: "test",
      command: "bun test",
      workspace: "root",
      packagePath: "package.json",
    },
    {
      name: "build",
      command: "bun build",
      workspace: "root",
      packagePath: "package.json",
    },
    {
      name: "dev",
      command: "bun dev",
      workspace: "root",
      packagePath: "package.json",
    },
  ];

  describe("createInitialState", () => {
    it("creates initial state with empty query", () => {
      const state = createInitialState(mockScripts);
      expect(state.query).toBe("");
      expect(state.selectedIndex).toBe(0);
      expect(state.scripts).toEqual(mockScripts);
      expect(state.matches).toHaveLength(3);
    });
  });

  describe("updateSelection", () => {
    it("moves selection down", () => {
      const state = createInitialState(mockScripts);
      const newState = updateSelection(state, 1);
      expect(newState.selectedIndex).toBe(1);
    });

    it("moves selection up", () => {
      const state = { ...createInitialState(mockScripts), selectedIndex: 2 };
      const newState = updateSelection(state, -1);
      expect(newState.selectedIndex).toBe(1);
    });

    it("does not go below 0", () => {
      const state = createInitialState(mockScripts);
      const newState = updateSelection(state, -1);
      expect(newState.selectedIndex).toBe(0);
    });

    it("does not go above max index", () => {
      const state = { ...createInitialState(mockScripts), selectedIndex: 2 };
      const newState = updateSelection(state, 1);
      expect(newState.selectedIndex).toBe(2);
    });
  });

  describe("getSelectedScript", () => {
    it("returns selected script", () => {
      const state = createInitialState(mockScripts);
      const selected = getSelectedScript(state);
      expect(selected).not.toBeNull();
      expect(selected?.name).toBe(mockScripts[0]?.name);
    });

    it("returns null when no matches", () => {
      const state = {
        ...createInitialState([]),
        matches: [],
        selectedIndex: 0,
      };
      const selected = getSelectedScript(state);
      expect(selected).toBeNull();
    });
  });
});
