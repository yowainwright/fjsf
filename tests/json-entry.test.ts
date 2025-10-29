import { describe, it, expect } from "bun:test";
import { flattenJson, formatValue } from "../src/json/entry.ts";
import type { JsonObject } from "../src/json/entry.ts";

describe("flattenJson", () => {
  it("flattens simple object", () => {
    const json: JsonObject = {
      name: "test",
      version: "1.0.0",
    };

    const entries = flattenJson(json, "package.json", "root");

    expect(entries).toHaveLength(2);
    expect(entries.some((e) => e.path === "name" && e.value === "test")).toBe(
      true,
    );
    expect(
      entries.some((e) => e.path === "version" && e.value === "1.0.0"),
    ).toBe(true);
  });

  it("flattens nested object with dot notation", () => {
    const json: JsonObject = {
      scripts: {
        test: "bun test",
        build: "bun build",
      },
    };

    const entries = flattenJson(json, "package.json", "root");

    expect(entries.some((e) => e.path === "scripts")).toBe(true);
    expect(
      entries.some((e) => e.path === "scripts.test" && e.value === "bun test"),
    ).toBe(true);
    expect(
      entries.some(
        (e) => e.path === "scripts.build" && e.value === "bun build",
      ),
    ).toBe(true);
  });

  it("flattens arrays", () => {
    const json: JsonObject = {
      keywords: ["cli", "tool"],
    };

    const entries = flattenJson(json, "package.json", "root");

    expect(entries.some((e) => e.path === "keywords")).toBe(true);
    expect(
      entries.some((e) => e.path === "keywords[0]" && e.value === "cli"),
    ).toBe(true);
    expect(
      entries.some((e) => e.path === "keywords[1]" && e.value === "tool"),
    ).toBe(true);
  });

  it("handles deeply nested objects", () => {
    const json: JsonObject = {
      config: {
        server: {
          port: 3000,
        },
      },
    };

    const entries = flattenJson(json, "package.json", "root");

    expect(
      entries.some((e) => e.path === "config.server.port" && e.value === 3000),
    ).toBe(true);
  });

  it("includes workspace and filePath metadata", () => {
    const json: JsonObject = { name: "test" };
    const entries = flattenJson(json, "packages/ui/package.json", "ui-package");

    expect(entries[0]?.workspace).toBe("ui-package");
    expect(entries[0]?.filePath).toBe("packages/ui/package.json");
  });
});

describe("formatValue", () => {
  it("formats strings", () => {
    expect(formatValue("hello")).toBe("hello");
  });

  it("formats numbers", () => {
    expect(formatValue(42)).toBe("42");
  });

  it("formats booleans", () => {
    expect(formatValue(true)).toBe("true");
    expect(formatValue(false)).toBe("false");
  });

  it("formats null", () => {
    expect(formatValue(null)).toBe("null");
  });

  it("formats arrays", () => {
    expect(formatValue([1, 2, 3])).toBe("Array(3)");
  });

  it("formats objects", () => {
    expect(formatValue({ a: 1, b: 2 })).toBe("Object(2)");
  });
});
