import { describe, it, expect } from "bun:test";
import { parseCliArgs, getModeTitle } from "../src/modes.ts";

describe("parseCliArgs", () => {
  it("defaults to scripts mode with no args", () => {
    const config = parseCliArgs([]);
    expect(config.mode).toBe("scripts");
  });

  it("parses json mode", () => {
    const config = parseCliArgs(["json"]);
    expect(config.mode).toBe("json");
  });

  it("parses json mode with shorthand", () => {
    const config = parseCliArgs(["j"]);
    expect(config.mode).toBe("json");
  });

  it("parses custom mode with file paths", () => {
    const config = parseCliArgs(["custom", "tsconfig.json", ".eslintrc.json"]);
    expect(config.mode).toBe("custom");
    expect(config.customPaths).toEqual(["tsconfig.json", ".eslintrc.json"]);
  });

  it("parses custom mode with shorthand", () => {
    const config = parseCliArgs(["c", "config.json"]);
    expect(config.mode).toBe("custom");
    expect(config.customPaths).toEqual(["config.json"]);
  });

  it("ignores flags in custom paths", () => {
    const config = parseCliArgs([
      "custom",
      "file.json",
      "--flag",
      "another.json",
    ]);
    expect(config.customPaths).toEqual(["file.json", "another.json"]);
  });
});

describe("getModeTitle", () => {
  it("returns scripts title", () => {
    const title = getModeTitle({ mode: "scripts" });
    expect(title).toBe("Fuzzy Package JSON - Scripts");
  });

  it("returns json title", () => {
    const title = getModeTitle({ mode: "json" });
    expect(title).toBe("Fuzzy Package JSON - Explorer");
  });

  it("returns custom title", () => {
    const title = getModeTitle({ mode: "custom", customPaths: [] });
    expect(title).toBe("Fuzzy Package JSON - Custom Files");
  });
});
