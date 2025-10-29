import { describe, it, expect } from "bun:test";
import { parseCliArgs, getModeTitle } from "../src/modes.ts";

describe("parseCliArgs", () => {
  it("defaults to scripts mode with no args", () => {
    const config = parseCliArgs([]);
    expect(config.mode).toBe("scripts");
  });

  it("parses find mode", () => {
    const config = parseCliArgs(["find", "package.json"]);
    expect(config.mode).toBe("find");
    expect(config.filePath).toBe("package.json");
  });

  it("parses find mode with shorthand", () => {
    const config = parseCliArgs(["f", "tsconfig.json"]);
    expect(config.mode).toBe("find");
    expect(config.filePath).toBe("tsconfig.json");
  });

  it("parses path mode", () => {
    const config = parseCliArgs(["path", "./config.json"]);
    expect(config.mode).toBe("path");
    expect(config.filePath).toBe("./config.json");
  });

  it("parses path mode with shorthand", () => {
    const config = parseCliArgs(["p", "./tsconfig.json"]);
    expect(config.mode).toBe("path");
    expect(config.filePath).toBe("./tsconfig.json");
  });

  it("parses exec mode", () => {
    const config = parseCliArgs(["exec", "package.json", "scripts.build"]);
    expect(config.mode).toBe("exec");
    expect(config.filePath).toBe("package.json");
    expect(config.execKey).toBe("scripts.build");
  });

  it("parses exec mode with shorthand", () => {
    const config = parseCliArgs(["e", "package.json", "scripts.test"]);
    expect(config.mode).toBe("exec");
    expect(config.filePath).toBe("package.json");
    expect(config.execKey).toBe("scripts.test");
  });

  it("parses help mode", () => {
    const config = parseCliArgs(["help"]);
    expect(config.mode).toBe("help");
  });

  it("parses help mode with shorthand", () => {
    const config = parseCliArgs(["h"]);
    expect(config.mode).toBe("help");
  });

  it("parses quit mode", () => {
    const config = parseCliArgs(["quit"]);
    expect(config.mode).toBe("quit");
  });

  it("parses quit mode with shorthand", () => {
    const config = parseCliArgs(["q"]);
    expect(config.mode).toBe("quit");
  });

  it("parses init mode", () => {
    const config = parseCliArgs(["init"]);
    expect(config.mode).toBe("init");
  });

  it("parses .json file as scripts mode with specific file", () => {
    const config = parseCliArgs(["./package.json"]);
    expect(config.mode).toBe("scripts");
    expect(config.filePath).toBe("./package.json");
  });
});

describe("getModeTitle", () => {
  it("returns scripts title", () => {
    const title = getModeTitle({ mode: "scripts" });
    expect(title).toBe("Fuzzy JSON Search & Filter - Scripts");
  });

  it("returns find title with filename", () => {
    const title = getModeTitle({ mode: "find", filePath: "package.json" });
    expect(title).toBe("Fuzzy JSON Search & Filter - Find: package.json");
  });

  it("returns path title with filename", () => {
    const title = getModeTitle({ mode: "path", filePath: "tsconfig.json" });
    expect(title).toBe("Fuzzy JSON Search & Filter - Path: tsconfig.json");
  });
});
