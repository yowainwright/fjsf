import { describe, it, expect } from "bun:test";
import { fuzzySearch } from "../src/fuzzy.ts";

describe("fuzzySearch", () => {
  const items = [
    { name: "test", value: 1 },
    { name: "testing", value: 2 },
    { name: "build", value: 3 },
    { name: "dev", value: 4 },
    { name: "development", value: 5 },
  ];

  it("returns all items when pattern is empty", () => {
    const results = fuzzySearch(items, "", (item) => item.name);
    expect(results).toHaveLength(5);
  });

  it("filters items by pattern", () => {
    const results = fuzzySearch(items, "test", (item) => item.name);
    expect(results).toHaveLength(2);
    expect(results[0]?.item.name).toBe("test");
    expect(results[1]?.item.name).toBe("testing");
  });

  it("returns empty array when no matches", () => {
    const results = fuzzySearch(items, "xyz", (item) => item.name);
    expect(results).toHaveLength(0);
  });

  it("scores exact matches higher than partial matches", () => {
    const results = fuzzySearch(items, "dev", (item) => item.name);
    expect(results[0]?.item.name).toBe("dev");
    expect(results[1]?.item.name).toBe("development");
  });

  it("handles case insensitive matching", () => {
    const results = fuzzySearch(items, "TEST", (item) => item.name);
    expect(results).toHaveLength(2);
  });

  it("matches characters in order", () => {
    const results = fuzzySearch(items, "tst", (item) => item.name);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.item.name).toBe("test");
  });
});
