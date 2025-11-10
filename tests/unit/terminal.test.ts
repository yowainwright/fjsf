import { describe, it, expect, mock } from "bun:test";
import {
  colors,
  colorize,
  highlightMatches,
  clearScreen,
  moveCursor,
  hideCursor,
  showCursor,
  enableRawMode,
  disableRawMode,
} from "../../src/terminal.ts";

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

  describe("clearScreen", () => {
    it("writes clear screen ANSI escape code", () => {
      const mockWrite = mock(() => {});
      const originalWrite = process.stdout.write;
      process.stdout.write = mockWrite as any;

      clearScreen();

      expect(mockWrite).toHaveBeenCalledWith("\x1b[2J\x1b[H");

      process.stdout.write = originalWrite;
    });
  });

  describe("moveCursor", () => {
    it("writes move cursor ANSI escape code", () => {
      const mockWrite = mock(() => {});
      const originalWrite = process.stdout.write;
      process.stdout.write = mockWrite as any;

      moveCursor(10, 20);

      expect(mockWrite).toHaveBeenCalledWith("\x1b[20;10H");

      process.stdout.write = originalWrite;
    });
  });

  describe("hideCursor", () => {
    it("writes hide cursor ANSI escape code", () => {
      const mockWrite = mock(() => {});
      const originalWrite = process.stdout.write;
      process.stdout.write = mockWrite as any;

      hideCursor();

      expect(mockWrite).toHaveBeenCalledWith("\x1b[?25l");

      process.stdout.write = originalWrite;
    });
  });

  describe("showCursor", () => {
    it("writes show cursor ANSI escape code", () => {
      const mockWrite = mock(() => {});
      const originalWrite = process.stdout.write;
      process.stdout.write = mockWrite as any;

      showCursor();

      expect(mockWrite).toHaveBeenCalledWith("\x1b[?25h");

      process.stdout.write = originalWrite;
    });
  });

  describe("enableRawMode", () => {
    it("enables raw mode when available", () => {
      const mockSetRawMode = mock(() => {});
      const mockResume = mock(() => {});
      const originalSetRawMode = process.stdin.setRawMode;
      const originalResume = process.stdin.resume;

      process.stdin.setRawMode = mockSetRawMode as any;
      process.stdin.resume = mockResume as any;

      enableRawMode();

      expect(mockSetRawMode).toHaveBeenCalledWith(true);
      expect(mockResume).toHaveBeenCalled();

      process.stdin.setRawMode = originalSetRawMode;
      process.stdin.resume = originalResume;
    });
  });

  describe("disableRawMode", () => {
    it("disables raw mode when available", () => {
      const mockSetRawMode = mock(() => {});
      const mockPause = mock(() => {});
      const originalSetRawMode = process.stdin.setRawMode;
      const originalPause = process.stdin.pause;

      process.stdin.setRawMode = mockSetRawMode as any;
      process.stdin.pause = mockPause as any;

      disableRawMode();

      expect(mockSetRawMode).toHaveBeenCalledWith(false);
      expect(mockPause).toHaveBeenCalled();

      process.stdin.setRawMode = originalSetRawMode;
      process.stdin.pause = originalPause;
    });
  });
});
