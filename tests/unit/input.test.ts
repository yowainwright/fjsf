import { describe, it, expect } from "bun:test";
import { handleInput } from "../../src/input.ts";
import { createInitialState } from "../../src/state.ts";
import type { PackageScript } from "../../src/types.ts";

describe("handleInput", () => {
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

  describe("exit keys", () => {
    it("returns null on Ctrl+C", async () => {
      const state = createInitialState(mockScripts);
      const result = await handleInput(state, Buffer.from("\x03"));
      expect(result).toBeNull();
    });

    it("returns null on Escape", async () => {
      const state = createInitialState(mockScripts);
      const result = await handleInput(state, Buffer.from("\x1b"));
      expect(result).toBeNull();
    });

    it("returns null on q key", async () => {
      const state = createInitialState(mockScripts);
      const result = await handleInput(state, Buffer.from("q"));
      expect(result).toBeNull();
    });
  });

  describe("navigation keys", () => {
    it("moves selection up on up arrow", async () => {
      const state = { ...createInitialState(mockScripts), selectedIndex: 1 };
      const result = await handleInput(state, Buffer.from("\x1b[A"));
      expect(result?.selectedIndex).toBe(0);
    });

    it("moves selection down on down arrow", async () => {
      const state = createInitialState(mockScripts);
      const result = await handleInput(state, Buffer.from("\x1b[B"));
      expect(result?.selectedIndex).toBe(1);
    });

    it("does not move above 0", async () => {
      const state = createInitialState(mockScripts);
      const result = await handleInput(state, Buffer.from("\x1b[A"));
      expect(result?.selectedIndex).toBe(0);
    });

    it("does not move below max index", async () => {
      const state = { ...createInitialState(mockScripts), selectedIndex: 2 };
      const result = await handleInput(state, Buffer.from("\x1b[B"));
      expect(result?.selectedIndex).toBe(2);
    });
  });

  describe("text input", () => {
    it("adds printable characters to query", async () => {
      const state = createInitialState(mockScripts);
      const result = await handleInput(state, Buffer.from("t"));
      expect(result?.query).toBe("t");
    });

    it("handles backspace", async () => {
      const state = { ...createInitialState(mockScripts), query: "test" };
      const result = await handleInput(state, Buffer.from("\x7f"));
      expect(result?.query).toBe("tes");
    });

    it("handles backspace on empty query", async () => {
      const state = createInitialState(mockScripts);
      const result = await handleInput(state, Buffer.from("\x7f"));
      expect(result?.query).toBe("");
    });

    it("appends multiple characters", async () => {
      const state = createInitialState(mockScripts);
      let result = await handleInput(state, Buffer.from("t"));
      result = await handleInput(result!, Buffer.from("e"));
      result = await handleInput(result!, Buffer.from("s"));
      expect(result?.query).toBe("tes");
    });

    it("resets selection when query changes", async () => {
      const state = { ...createInitialState(mockScripts), selectedIndex: 2 };
      const result = await handleInput(state, Buffer.from("t"));
      expect(result?.selectedIndex).toBe(0);
    });
  });

  describe("special characters", () => {
    it("handles space character", async () => {
      const state = createInitialState(mockScripts);
      const result = await handleInput(state, Buffer.from(" "));
      expect(result?.query).toBe(" ");
    });

    it("handles numbers", async () => {
      const state = createInitialState(mockScripts);
      const result = await handleInput(state, Buffer.from("1"));
      expect(result?.query).toBe("1");
    });

    it("ignores non-printable characters", async () => {
      const state = createInitialState(mockScripts);
      const result = await handleInput(state, Buffer.from("\x01"));
      expect(result).toEqual(state);
    });
  });

  describe("state immutability", () => {
    it("does not mutate original state", async () => {
      const state = createInitialState(mockScripts);
      const originalQuery = state.query;
      const originalIndex = state.selectedIndex;

      await handleInput(state, Buffer.from("t"));

      expect(state.query).toBe(originalQuery);
      expect(state.selectedIndex).toBe(originalIndex);
    });
  });
});
