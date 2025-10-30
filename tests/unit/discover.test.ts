import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { discoverScripts } from "../../src/discover.ts";
import { clearCache } from "../../src/cache.ts";

const TEST_DIR = join(process.cwd(), "test-fixtures");

const cleanup = () => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  clearCache();
};

const setup = () => {
  cleanup();
  mkdirSync(TEST_DIR, { recursive: true });
};

describe("discoverScripts", () => {
  beforeEach(setup);
  afterEach(cleanup);

  it("returns empty array when no package.json exists", () => {
    const scripts = discoverScripts(TEST_DIR);
    expect(scripts).toEqual([]);
  });

  it("discovers scripts from root package.json", () => {
    const packageJson = {
      name: "test-project",
      scripts: {
        test: "bun test",
        build: "bun build",
      },
    };

    writeFileSync(join(TEST_DIR, "package.json"), JSON.stringify(packageJson));

    const scripts = discoverScripts(TEST_DIR);
    expect(scripts).toHaveLength(2);
    expect(scripts[0]?.name).toBe("test");
    expect(scripts[0]?.command).toBe("bun test");
    expect(scripts[0]?.workspace).toBe("test-project");
  });

  it("discovers scripts from workspace packages with array format", () => {
    const rootPackage = {
      name: "monorepo",
      workspaces: ["packages/*"],
      scripts: {
        root: "echo root",
      },
    };

    const pkg1 = {
      name: "pkg1",
      scripts: {
        test: "bun test",
      },
    };

    writeFileSync(join(TEST_DIR, "package.json"), JSON.stringify(rootPackage));
    mkdirSync(join(TEST_DIR, "packages", "pkg1"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, "packages", "pkg1", "package.json"),
      JSON.stringify(pkg1),
    );

    const scripts = discoverScripts(TEST_DIR);
    expect(scripts).toHaveLength(2);
    expect(scripts.some((s) => s.workspace === "monorepo")).toBe(true);
    expect(scripts.some((s) => s.workspace === "pkg1")).toBe(true);
  });

  it("discovers scripts from workspace packages with object format", () => {
    const rootPackage = {
      name: "monorepo",
      workspaces: {
        packages: ["apps/*"],
      },
      scripts: {
        root: "echo root",
      },
    };

    const app1 = {
      name: "app1",
      scripts: {
        dev: "bun run dev",
      },
    };

    writeFileSync(join(TEST_DIR, "package.json"), JSON.stringify(rootPackage));
    mkdirSync(join(TEST_DIR, "apps", "app1"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, "apps", "app1", "package.json"),
      JSON.stringify(app1),
    );

    const scripts = discoverScripts(TEST_DIR);
    expect(scripts).toHaveLength(2);
    expect(scripts.some((s) => s.workspace === "app1")).toBe(true);
  });

  it("discovers nested package.json files without workspaces", () => {
    const rootPackage = {
      name: "project",
      scripts: {
        root: "echo root",
      },
    };

    const nestedPackage = {
      name: "nested",
      scripts: {
        nested: "echo nested",
      },
    };

    writeFileSync(join(TEST_DIR, "package.json"), JSON.stringify(rootPackage));
    mkdirSync(join(TEST_DIR, "sub", "nested"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, "sub", "nested", "package.json"),
      JSON.stringify(nestedPackage),
    );

    const scripts = discoverScripts(TEST_DIR);
    expect(scripts).toHaveLength(2);
    expect(scripts.some((s) => s.workspace === "nested")).toBe(true);
  });

  it("handles package.json without scripts", () => {
    const packageJson = {
      name: "no-scripts",
    };

    writeFileSync(join(TEST_DIR, "package.json"), JSON.stringify(packageJson));

    const scripts = discoverScripts(TEST_DIR);
    expect(scripts.filter((s) => s.workspace === "no-scripts")).toEqual([]);
  });

  it("handles invalid package.json", () => {
    writeFileSync(join(TEST_DIR, "package.json"), "invalid json");

    const scripts = discoverScripts(TEST_DIR);
    expect(scripts).toEqual([]);
  });

  it("uses package name as workspace when available", () => {
    const packageJson = {
      name: "my-package",
      scripts: {
        test: "bun test",
      },
    };

    writeFileSync(join(TEST_DIR, "package.json"), JSON.stringify(packageJson));

    const scripts = discoverScripts(TEST_DIR);
    expect(scripts[0]?.workspace).toBe("my-package");
  });

  it("uses relative path as workspace when name not available", () => {
    const packageJson = {
      scripts: {
        test: "bun test",
      },
    };

    writeFileSync(join(TEST_DIR, "package.json"), JSON.stringify(packageJson));

    const scripts = discoverScripts(TEST_DIR);
    expect(scripts[0]?.workspace).toBe("root");
  });
});
