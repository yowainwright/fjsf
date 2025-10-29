import { describe, it, expect } from "bun:test";
import { colors, colorize, highlightMatches } from "../src/terminal.ts";

describe("terminal", () => {
  describe("colorize", () => {
    it("wraps text with color codes", () => {
      const result = colorize("hello", colors.green);
      expect(result).toBe(`${colors.green}hello${colors.reset}`);
    });

    it("handles empty text", () => {
      const result = colorize("", colors.green);
      expect(result).toBe(`${colors.green}${colors.reset}`);
    });

    it("works with combined colors", () => {
      const result = colorize("bold green", colors.bright + colors.green);
      expect(result).toBe(
        `${colors.bright}${colors.green}bold green${colors.reset}`,
      );
    });
  });

  describe("highlightMatches", () => {
    it("highlights matched character positions", () => {
      const result = highlightMatches("hello", [0, 1]);
      expect(result).toContain(colors.bright);
      expect(result).toContain(colors.cyan);
      expect(result).toContain("h");
      expect(result).toContain("e");
    });

    it("handles no matches", () => {
      const result = highlightMatches("hello", []);
      expect(result).toBe("hello");
    });

    it("handles all characters matched", () => {
      const result = highlightMatches("hi", [0, 1]);
      expect(result).toContain(colors.bright);
      expect(result).toContain(colors.cyan);
    });

    it("highlights non-consecutive matches", () => {
      const result = highlightMatches("hello", [0, 4]);
      expect(result).toContain("h");
      expect(result).toContain("o");
      expect(result).toContain("ell");
    });

    it("handles empty text", () => {
      const result = highlightMatches("", []);
      expect(result).toBe("");
    });
  });

  describe("colors", () => {
    it("has all expected color codes", () => {
      expect(colors.reset).toBe("\x1b[0m");
      expect(colors.bright).toBe("\x1b[1m");
      expect(colors.dim).toBe("\x1b[2m");
      expect(colors.cyan).toBe("\x1b[36m");
      expect(colors.green).toBe("\x1b[32m");
      expect(colors.yellow).toBe("\x1b[33m");
      expect(colors.blue).toBe("\x1b[34m");
      expect(colors.magenta).toBe("\x1b[35m");
      expect(colors.gray).toBe("\x1b[90m");
    });
  });
});
