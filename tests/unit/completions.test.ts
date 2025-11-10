import { describe, it, expect } from "bun:test";
import { runCompletions } from "../../src/completions.ts";
import { stdout } from "process";

describe("completions", () => {
  it("outputs all scripts when no query provided", () => {
    let output = "";
    const originalWrite = stdout.write;
    stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as any;

    runCompletions();

    stdout.write = originalWrite;

    expect(output).toContain("dev:");
    expect(output).toContain("build:");
    expect(output).toContain("test:");
    expect(output.length).toBeGreaterThan(0);
  });

  it("filters scripts by query", () => {
    let output = "";
    const originalWrite = stdout.write;
    stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as any;

    runCompletions("build");

    stdout.write = originalWrite;

    expect(output).toContain("build:");
    expect(output.split("\n").length).toBeGreaterThan(0);
  });

  it("outputs in correct format for completions", () => {
    let output = "";
    const originalWrite = stdout.write;
    stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as any;

    runCompletions();

    stdout.write = originalWrite;

    const lines = output.split("\n").filter((line) => line.length > 0);
    const hasCorrectFormat = lines.every((line) => line.includes(":"));
    expect(hasCorrectFormat).toBe(true);

    const firstLine = lines[0];
    if (firstLine) {
      const parts = firstLine.split(":");
      expect(parts.length).toBeGreaterThanOrEqual(2);
      expect(parts[0]?.length).toBeGreaterThan(0);
    }
  });

  it("handles fuzzy matching", () => {
    let output = "";
    const originalWrite = stdout.write;
    stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as any;

    runCompletions("bld");

    stdout.write = originalWrite;

    expect(output).toContain("build");
  });

  it("returns empty when no matches found", () => {
    let output = "";
    const originalWrite = stdout.write;
    stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as any;

    runCompletions("zzzznonexistent");

    stdout.write = originalWrite;

    expect(output).toBe("");
  });

  it("includes workspace information in output", () => {
    let output = "";
    const originalWrite = stdout.write;
    stdout.write = ((chunk: string) => {
      output += chunk;
      return true;
    }) as any;

    runCompletions();

    stdout.write = originalWrite;

    const lines = output.split("\n").filter((line) => line.length > 0);
    const hasWorkspaceInfo = lines.some((line) => line.includes("["));
    expect(hasWorkspaceInfo).toBe(true);
  });
});
