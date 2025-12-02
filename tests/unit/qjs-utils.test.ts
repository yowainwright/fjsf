import { describe, it, expect } from "bun:test";

const join = (...parts: (string | undefined | null)[]): string =>
  parts.filter(Boolean).join("/").replace(/\/+/g, "/");

const dirname = (path: string): string => {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "." : path.slice(0, idx) || "/";
};

const basename = (path: string): string => {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? path : path.slice(idx + 1);
};

const relative = (from: string, to: string): string => {
  if (to.startsWith(from)) {
    const rel = to.slice(from.length);
    return rel.startsWith("/") ? rel.slice(1) : rel;
  }
  return to;
};

const toAbsolutePath = (cwd: string, filePath: string): string =>
  filePath.startsWith("/") ? filePath : join(cwd, filePath);

const isSkippableEntry = (entry: string): boolean =>
  entry === "node_modules" || entry.startsWith(".");

const hasGlobPattern = (pattern: string): boolean => pattern.includes("*");

const getBaseDir = (pattern: string): string => {
  const parts = pattern.split("*");
  return parts[0] || "";
};

const parseJson = (content: string): unknown => {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
};

interface JsonEntry {
  path: string;
  value: string;
  key: string;
  filePath: string;
  workspace: string;
}

const createEntry = (
  path: string,
  value: string,
  key: string,
  filePath: string,
  workspace: string,
): JsonEntry => ({ path, value, key, filePath, workspace });

const flattenValue = (
  value: unknown,
  path: string,
  key: string,
  filePath: string,
  workspace: string,
): JsonEntry[] => {
  if (value === null) {
    return [createEntry(path, "null", key, filePath, workspace)];
  }

  if (Array.isArray(value)) {
    const selfEntry = createEntry(
      path,
      `Array(${value.length})`,
      key,
      filePath,
      workspace,
    );
    const childEntries = value.flatMap((item, i) =>
      flattenValue(item, `${path}[${i}]`, `[${i}]`, filePath, workspace),
    );
    return [selfEntry, ...childEntries];
  }

  const isObject = typeof value === "object";
  if (isObject) {
    const keys = Object.keys(value as Record<string, unknown>);
    const selfEntry = createEntry(
      path,
      `Object(${keys.length})`,
      key,
      filePath,
      workspace,
    );
    const childEntries = keys.flatMap((k) => {
      const newPath = path ? `${path}.${k}` : k;
      return flattenValue(
        (value as Record<string, unknown>)[k],
        newPath,
        k,
        filePath,
        workspace,
      );
    });
    return [selfEntry, ...childEntries];
  }

  return [createEntry(path, String(value), key, filePath, workspace)];
};

const flattenJson = (
  obj: Record<string, unknown>,
  _prefix: string,
  filePath: string,
  workspace: string,
): JsonEntry[] =>
  Object.keys(obj).flatMap((k) =>
    flattenValue(obj[k], k, k, filePath, workspace),
  );

const getNestedValue = (obj: Record<string, unknown>, path: string): unknown =>
  path.split(".").reduce((current: unknown, key: string) => {
    const isNullish = current === null || current === undefined;
    return isNullish ? undefined : (current as Record<string, unknown>)[key];
  }, obj);

const getWorkspacePatterns = (packageJson: {
  workspaces?: string[] | { packages?: string[] };
}): string[] => {
  const workspaces = packageJson.workspaces;
  if (Array.isArray(workspaces)) return workspaces;
  if (workspaces && workspaces.packages) return workspaces.packages;
  return [];
};

interface Script {
  name: string;
  command: string;
  workspace: string;
  packagePath: string;
}

const buildRunCommand = (script: Script, pm: string): string[] => {
  const isRootPackage = script.packagePath === "package.json";

  if (pm === "pnpm") {
    return isRootPackage
      ? ["pnpm", "run", script.name]
      : ["pnpm", "--filter", script.workspace, "run", script.name];
  }

  if (pm === "yarn") {
    return isRootPackage
      ? ["yarn", "run", script.name]
      : ["yarn", "workspace", script.workspace, "run", script.name];
  }

  if (pm === "bun") {
    return isRootPackage
      ? ["bun", "run", script.name]
      : ["bun", "--filter", script.workspace, "run", script.name];
  }

  return isRootPackage
    ? ["npm", "run", script.name]
    : ["npm", "run", script.name, "--workspace=" + script.workspace];
};

const buildSimpleRunCommand = (pm: string, scriptName: string): string[] => {
  const commands: Record<string, string[]> = {
    pnpm: ["pnpm", "run", scriptName],
    yarn: ["yarn", "run", scriptName],
    bun: ["bun", "run", scriptName],
    npm: ["npm", "run", scriptName],
  };
  return commands[pm] ?? commands.npm!;
};

const matchesQuery = (
  script: { name: string; workspace: string },
  lowerQuery: string,
): boolean => {
  if (!lowerQuery) return true;
  const nameMatches = script.name.toLowerCase().includes(lowerQuery);
  const workspaceMatches = script.workspace.toLowerCase().includes(lowerQuery);
  return nameMatches || workspaceMatches;
};

const formatCompletion = (script: Script): string =>
  `${script.name}:[${script.workspace}] ${script.command}`;

const createDefaultOptions = () => ({
  help: false,
  version: false,
  quit: false,
  completions: false,
  completionsQuery: "",
  mode: "scripts",
  filePath: undefined as string | undefined,
  execKey: undefined as string | undefined,
  initMode: "widget",
});

const isHelpArg = (arg: string): boolean =>
  ["help", "h", "--help", "-h"].includes(arg);

const isVersionArg = (arg: string): boolean =>
  ["--version", "-v"].includes(arg);

const isQuitArg = (arg: string): boolean => ["quit", "q"].includes(arg);

const isCompletionsArg = (arg: string): boolean =>
  ["completions", "--completions"].includes(arg);

const isFindArg = (arg: string): boolean => ["find", "f"].includes(arg);

const isPathArg = (arg: string): boolean => ["path", "p"].includes(arg);

const isExecArg = (arg: string): boolean => ["exec", "e"].includes(arg);

const hasNextArg = (args: string[], i: number): boolean => i + 1 < args.length;

const getNextArg = (args: string[], i: number): string | undefined =>
  hasNextArg(args, i) ? args[i + 1] : undefined;

const KEY_CODES = {
  CTRL_C: 3,
  BACKSPACE: 8,
  ENTER_CR: 10,
  ENTER_LF: 13,
  ESCAPE: 27,
  BRACKET: 91,
  ARROW_UP: 65,
  ARROW_DOWN: 66,
  Q: 113,
  DELETE: 127,
  PRINTABLE_START: 32,
  PRINTABLE_END: 127,
};

const isExitKey = (byte0: number, key: Uint8Array): boolean => {
  const isCtrlC = byte0 === KEY_CODES.CTRL_C;
  const isEscape = byte0 === KEY_CODES.ESCAPE && key.length === 1;
  const isQKey = byte0 === KEY_CODES.Q;
  return isCtrlC || isEscape || isQKey;
};

const isEnterKey = (byte0: number): boolean =>
  byte0 === KEY_CODES.ENTER_CR || byte0 === KEY_CODES.ENTER_LF;

const isArrowSequence = (byte0: number, key: Uint8Array): boolean =>
  byte0 === KEY_CODES.ESCAPE && key.length >= 3 && key[1] === KEY_CODES.BRACKET;

const isBackspaceKey = (byte0: number): boolean =>
  byte0 === KEY_CODES.DELETE || byte0 === KEY_CODES.BACKSPACE;

const isPrintableChar = (byte0: number): boolean =>
  byte0 >= KEY_CODES.PRINTABLE_START && byte0 < KEY_CODES.PRINTABLE_END;

describe("Path utilities", () => {
  describe("join", () => {
    it("joins path segments with /", () => {
      expect(join("a", "b", "c")).toBe("a/b/c");
    });

    it("filters out falsy values", () => {
      expect(join("a", null, "b", undefined, "c")).toBe("a/b/c");
    });

    it("collapses multiple slashes", () => {
      expect(join("a//", "/b")).toBe("a/b");
    });

    it("handles empty input", () => {
      expect(join()).toBe("");
    });

    it("handles single segment", () => {
      expect(join("a")).toBe("a");
    });

    it("handles absolute paths", () => {
      expect(join("/", "a", "b")).toBe("/a/b");
    });
  });

  describe("dirname", () => {
    it("returns parent directory", () => {
      expect(dirname("/a/b/c")).toBe("/a/b");
    });

    it("returns / for root paths", () => {
      expect(dirname("/a")).toBe("/");
    });

    it("returns . for paths without /", () => {
      expect(dirname("file.txt")).toBe(".");
    });

    it("handles nested paths", () => {
      expect(dirname("/usr/local/bin/file")).toBe("/usr/local/bin");
    });
  });

  describe("basename", () => {
    it("returns file name from path", () => {
      expect(basename("/a/b/c.txt")).toBe("c.txt");
    });

    it("returns input if no /", () => {
      expect(basename("file.txt")).toBe("file.txt");
    });

    it("handles directories", () => {
      expect(basename("/a/b/c")).toBe("c");
    });
  });

  describe("relative", () => {
    it("returns relative path when to starts with from", () => {
      expect(relative("/a/b", "/a/b/c/d")).toBe("c/d");
    });

    it("strips leading / from result", () => {
      expect(relative("/a/b", "/a/b/c")).toBe("c");
    });

    it("returns to if not a subpath", () => {
      expect(relative("/a/b", "/x/y")).toBe("/x/y");
    });

    it("handles exact match", () => {
      expect(relative("/a/b", "/a/b")).toBe("");
    });
  });

  describe("toAbsolutePath", () => {
    it("returns path unchanged if already absolute", () => {
      expect(toAbsolutePath("/cwd", "/absolute/path")).toBe("/absolute/path");
    });

    it("joins cwd with relative path", () => {
      expect(toAbsolutePath("/cwd", "relative/path")).toBe(
        "/cwd/relative/path",
      );
    });

    it("handles current directory", () => {
      expect(toAbsolutePath("/home/user", "file.txt")).toBe(
        "/home/user/file.txt",
      );
    });
  });
});

describe("Entry filtering", () => {
  describe("isSkippableEntry", () => {
    it("returns true for node_modules", () => {
      expect(isSkippableEntry("node_modules")).toBe(true);
    });

    it("returns true for dotfiles", () => {
      expect(isSkippableEntry(".git")).toBe(true);
      expect(isSkippableEntry(".env")).toBe(true);
    });

    it("returns false for regular directories", () => {
      expect(isSkippableEntry("src")).toBe(false);
      expect(isSkippableEntry("packages")).toBe(false);
    });
  });
});

describe("Glob utilities", () => {
  describe("hasGlobPattern", () => {
    it("returns true for patterns with *", () => {
      expect(hasGlobPattern("packages/*")).toBe(true);
      expect(hasGlobPattern("*")).toBe(true);
    });

    it("returns false for patterns without *", () => {
      expect(hasGlobPattern("packages/app")).toBe(false);
      expect(hasGlobPattern("src")).toBe(false);
    });
  });

  describe("getBaseDir", () => {
    it("returns part before *", () => {
      expect(getBaseDir("packages/*")).toBe("packages/");
    });

    it("returns empty string for leading *", () => {
      expect(getBaseDir("*")).toBe("");
    });

    it("handles multiple *", () => {
      expect(getBaseDir("a/*/b/*")).toBe("a/");
    });
  });
});

describe("JSON utilities", () => {
  describe("parseJson", () => {
    it("parses valid JSON", () => {
      expect(parseJson('{"a": 1}')).toEqual({ a: 1 });
    });

    it("returns null for invalid JSON", () => {
      expect(parseJson("not json")).toBe(null);
    });

    it("parses arrays", () => {
      expect(parseJson("[1, 2, 3]")).toEqual([1, 2, 3]);
    });

    it("parses primitives", () => {
      expect(parseJson("42")).toBe(42);
      expect(parseJson('"hello"')).toBe("hello");
      expect(parseJson("true")).toBe(true);
      expect(parseJson("null")).toBe(null);
    });
  });

  describe("createEntry", () => {
    it("creates entry object", () => {
      const entry = createEntry(
        "path.to.key",
        "value",
        "key",
        "file.json",
        "workspace",
      );
      expect(entry).toEqual({
        path: "path.to.key",
        value: "value",
        key: "key",
        filePath: "file.json",
        workspace: "workspace",
      });
    });
  });

  describe("flattenValue", () => {
    it("flattens null", () => {
      const entries = flattenValue(null, "key", "key", "file.json", "ws");
      expect(entries).toHaveLength(1);
      expect(entries[0]!.value).toBe("null");
    });

    it("flattens primitive values", () => {
      const entries = flattenValue("hello", "key", "key", "file.json", "ws");
      expect(entries).toHaveLength(1);
      expect(entries[0]!.value).toBe("hello");
    });

    it("flattens arrays", () => {
      const entries = flattenValue([1, 2], "arr", "arr", "file.json", "ws");
      expect(entries).toHaveLength(3);
      expect(entries[0]!.value).toBe("Array(2)");
      expect(entries[1]!.path).toBe("arr[0]");
      expect(entries[2]!.path).toBe("arr[1]");
    });

    it("flattens objects", () => {
      const entries = flattenValue(
        { a: 1, b: 2 },
        "obj",
        "obj",
        "file.json",
        "ws",
      );
      expect(entries).toHaveLength(3);
      expect(entries[0]!.value).toBe("Object(2)");
      expect(entries[1]!.path).toBe("obj.a");
      expect(entries[2]!.path).toBe("obj.b");
    });

    it("flattens nested structures", () => {
      const obj = { a: { b: 1 } };
      const entries = flattenValue(obj, "obj", "obj", "file.json", "ws");
      expect(entries.some((e) => e.path === "obj.a.b")).toBe(true);
    });
  });

  describe("flattenJson", () => {
    it("flattens top-level object", () => {
      const obj = { name: "test", version: "1.0.0" };
      const entries = flattenJson(obj, "", "file.json", "ws");
      expect(entries.some((e) => e.path === "name")).toBe(true);
      expect(entries.some((e) => e.path === "version")).toBe(true);
    });
  });

  describe("getNestedValue", () => {
    it("gets top-level value", () => {
      expect(getNestedValue({ a: 1 }, "a")).toBe(1);
    });

    it("gets nested value", () => {
      expect(getNestedValue({ a: { b: { c: 1 } } }, "a.b.c")).toBe(1);
    });

    it("returns undefined for missing path", () => {
      expect(getNestedValue({ a: 1 }, "b")).toBe(undefined);
    });

    it("returns undefined for null in path", () => {
      expect(getNestedValue({ a: null }, "a.b")).toBe(undefined);
    });

    it("handles array access via dot notation", () => {
      expect(getNestedValue({ a: [1, 2, 3] }, "a.1")).toBe(2);
    });
  });
});

describe("Workspace utilities", () => {
  describe("getWorkspacePatterns", () => {
    it("returns array workspaces directly", () => {
      const pkg = { workspaces: ["packages/*"] };
      expect(getWorkspacePatterns(pkg)).toEqual(["packages/*"]);
    });

    it("returns packages from object workspaces", () => {
      const pkg = { workspaces: { packages: ["apps/*", "libs/*"] } };
      expect(getWorkspacePatterns(pkg)).toEqual(["apps/*", "libs/*"]);
    });

    it("returns empty array when no workspaces", () => {
      expect(getWorkspacePatterns({})).toEqual([]);
    });

    it("returns empty array for undefined workspaces", () => {
      expect(getWorkspacePatterns({ workspaces: undefined })).toEqual([]);
    });
  });
});

describe("Build command utilities", () => {
  describe("buildRunCommand", () => {
    const rootScript: Script = {
      name: "test",
      command: "jest",
      workspace: "root",
      packagePath: "package.json",
    };
    const workspaceScript: Script = {
      name: "build",
      command: "tsc",
      workspace: "@app/core",
      packagePath: "packages/core/package.json",
    };

    it("builds npm command for root package", () => {
      expect(buildRunCommand(rootScript, "npm")).toEqual([
        "npm",
        "run",
        "test",
      ]);
    });

    it("builds npm command for workspace package", () => {
      expect(buildRunCommand(workspaceScript, "npm")).toEqual([
        "npm",
        "run",
        "build",
        "--workspace=@app/core",
      ]);
    });

    it("builds pnpm command for root package", () => {
      expect(buildRunCommand(rootScript, "pnpm")).toEqual([
        "pnpm",
        "run",
        "test",
      ]);
    });

    it("builds pnpm command for workspace package", () => {
      expect(buildRunCommand(workspaceScript, "pnpm")).toEqual([
        "pnpm",
        "--filter",
        "@app/core",
        "run",
        "build",
      ]);
    });

    it("builds yarn command for root package", () => {
      expect(buildRunCommand(rootScript, "yarn")).toEqual([
        "yarn",
        "run",
        "test",
      ]);
    });

    it("builds yarn command for workspace package", () => {
      expect(buildRunCommand(workspaceScript, "yarn")).toEqual([
        "yarn",
        "workspace",
        "@app/core",
        "run",
        "build",
      ]);
    });

    it("builds bun command for root package", () => {
      expect(buildRunCommand(rootScript, "bun")).toEqual([
        "bun",
        "run",
        "test",
      ]);
    });

    it("builds bun command for workspace package", () => {
      expect(buildRunCommand(workspaceScript, "bun")).toEqual([
        "bun",
        "--filter",
        "@app/core",
        "run",
        "build",
      ]);
    });
  });

  describe("buildSimpleRunCommand", () => {
    it("builds npm command", () => {
      expect(buildSimpleRunCommand("npm", "test")).toEqual([
        "npm",
        "run",
        "test",
      ]);
    });

    it("builds pnpm command", () => {
      expect(buildSimpleRunCommand("pnpm", "build")).toEqual([
        "pnpm",
        "run",
        "build",
      ]);
    });

    it("builds yarn command", () => {
      expect(buildSimpleRunCommand("yarn", "dev")).toEqual([
        "yarn",
        "run",
        "dev",
      ]);
    });

    it("builds bun command", () => {
      expect(buildSimpleRunCommand("bun", "start")).toEqual([
        "bun",
        "run",
        "start",
      ]);
    });

    it("defaults to npm for unknown manager", () => {
      expect(buildSimpleRunCommand("unknown", "test")).toEqual([
        "npm",
        "run",
        "test",
      ]);
    });
  });
});

describe("Completion utilities", () => {
  describe("matchesQuery", () => {
    const script = { name: "test:unit", workspace: "@app/core" };

    it("returns true for empty query", () => {
      expect(matchesQuery(script, "")).toBe(true);
    });

    it("matches by script name", () => {
      expect(matchesQuery(script, "test")).toBe(true);
      expect(matchesQuery(script, "unit")).toBe(true);
    });

    it("matches by workspace name", () => {
      expect(matchesQuery(script, "core")).toBe(true);
      expect(matchesQuery(script, "app")).toBe(true);
    });

    it("expects lowercase query (caller must lowercase)", () => {
      // Function expects lowerQuery - uppercase won't match
      expect(matchesQuery(script, "TEST")).toBe(false);
      expect(matchesQuery(script, "test")).toBe(true);
    });

    it("returns false for non-matching query", () => {
      expect(matchesQuery(script, "xyz")).toBe(false);
    });
  });

  describe("formatCompletion", () => {
    it("formats script as completion line", () => {
      const script: Script = {
        name: "test",
        command: "jest",
        workspace: "@app/core",
        packagePath: "packages/core/package.json",
      };
      expect(formatCompletion(script)).toBe("test:[@app/core] jest");
    });
  });
});

describe("Argument parsing utilities", () => {
  describe("createDefaultOptions", () => {
    it("creates default options object", () => {
      const opts = createDefaultOptions();
      expect(opts.help).toBe(false);
      expect(opts.version).toBe(false);
      expect(opts.quit).toBe(false);
      expect(opts.completions).toBe(false);
      expect(opts.completionsQuery).toBe("");
      expect(opts.mode).toBe("scripts");
      expect(opts.filePath).toBe(undefined);
      expect(opts.execKey).toBe(undefined);
      expect(opts.initMode).toBe("widget");
    });
  });

  describe("isHelpArg", () => {
    it("recognizes help arguments", () => {
      expect(isHelpArg("help")).toBe(true);
      expect(isHelpArg("h")).toBe(true);
      expect(isHelpArg("--help")).toBe(true);
      expect(isHelpArg("-h")).toBe(true);
    });

    it("rejects non-help arguments", () => {
      expect(isHelpArg("test")).toBe(false);
      expect(isHelpArg("--version")).toBe(false);
    });
  });

  describe("isVersionArg", () => {
    it("recognizes version arguments", () => {
      expect(isVersionArg("--version")).toBe(true);
      expect(isVersionArg("-v")).toBe(true);
    });

    it("rejects non-version arguments", () => {
      expect(isVersionArg("version")).toBe(false);
      expect(isVersionArg("v")).toBe(false);
    });
  });

  describe("isQuitArg", () => {
    it("recognizes quit arguments", () => {
      expect(isQuitArg("quit")).toBe(true);
      expect(isQuitArg("q")).toBe(true);
    });

    it("rejects non-quit arguments", () => {
      expect(isQuitArg("exit")).toBe(false);
    });
  });

  describe("isCompletionsArg", () => {
    it("recognizes completions arguments", () => {
      expect(isCompletionsArg("completions")).toBe(true);
      expect(isCompletionsArg("--completions")).toBe(true);
    });

    it("rejects non-completions arguments", () => {
      expect(isCompletionsArg("complete")).toBe(false);
    });
  });

  describe("isFindArg", () => {
    it("recognizes find arguments", () => {
      expect(isFindArg("find")).toBe(true);
      expect(isFindArg("f")).toBe(true);
    });

    it("rejects non-find arguments", () => {
      expect(isFindArg("search")).toBe(false);
    });
  });

  describe("isPathArg", () => {
    it("recognizes path arguments", () => {
      expect(isPathArg("path")).toBe(true);
      expect(isPathArg("p")).toBe(true);
    });

    it("rejects non-path arguments", () => {
      expect(isPathArg("file")).toBe(false);
    });
  });

  describe("isExecArg", () => {
    it("recognizes exec arguments", () => {
      expect(isExecArg("exec")).toBe(true);
      expect(isExecArg("e")).toBe(true);
    });

    it("rejects non-exec arguments", () => {
      expect(isExecArg("run")).toBe(false);
    });
  });

  describe("hasNextArg", () => {
    it("returns true when next arg exists", () => {
      expect(hasNextArg(["a", "b", "c"], 0)).toBe(true);
      expect(hasNextArg(["a", "b", "c"], 1)).toBe(true);
    });

    it("returns false at last index", () => {
      expect(hasNextArg(["a", "b", "c"], 2)).toBe(false);
    });

    it("returns false for empty array", () => {
      expect(hasNextArg([], 0)).toBe(false);
    });
  });

  describe("getNextArg", () => {
    it("returns next argument when it exists", () => {
      expect(getNextArg(["a", "b", "c"], 0)).toBe("b");
      expect(getNextArg(["a", "b", "c"], 1)).toBe("c");
    });

    it("returns undefined at last index", () => {
      expect(getNextArg(["a", "b", "c"], 2)).toBe(undefined);
    });
  });
});

describe("Key detection utilities", () => {
  describe("isExitKey", () => {
    it("recognizes Ctrl+C", () => {
      expect(isExitKey(3, new Uint8Array([3]))).toBe(true);
    });

    it("recognizes Escape (single byte)", () => {
      expect(isExitKey(27, new Uint8Array([27]))).toBe(true);
    });

    it("recognizes q key", () => {
      expect(isExitKey(113, new Uint8Array([113]))).toBe(true);
    });

    it("does not treat escape sequence as exit", () => {
      expect(isExitKey(27, new Uint8Array([27, 91, 65]))).toBe(false);
    });

    it("rejects other keys", () => {
      expect(isExitKey(65, new Uint8Array([65]))).toBe(false);
    });
  });

  describe("isEnterKey", () => {
    it("recognizes carriage return", () => {
      expect(isEnterKey(13)).toBe(true);
    });

    it("recognizes line feed", () => {
      expect(isEnterKey(10)).toBe(true);
    });

    it("rejects other keys", () => {
      expect(isEnterKey(32)).toBe(false);
    });
  });

  describe("isArrowSequence", () => {
    it("recognizes up arrow sequence", () => {
      const key = new Uint8Array([27, 91, 65]);
      expect(isArrowSequence(27, key)).toBe(true);
    });

    it("recognizes down arrow sequence", () => {
      const key = new Uint8Array([27, 91, 66]);
      expect(isArrowSequence(27, key)).toBe(true);
    });

    it("rejects single escape", () => {
      const key = new Uint8Array([27]);
      expect(isArrowSequence(27, key)).toBe(false);
    });

    it("rejects non-escape sequences", () => {
      const key = new Uint8Array([65, 91, 65]);
      expect(isArrowSequence(65, key)).toBe(false);
    });
  });

  describe("isBackspaceKey", () => {
    it("recognizes delete (127)", () => {
      expect(isBackspaceKey(127)).toBe(true);
    });

    it("recognizes backspace (8)", () => {
      expect(isBackspaceKey(8)).toBe(true);
    });

    it("rejects other keys", () => {
      expect(isBackspaceKey(65)).toBe(false);
    });
  });

  describe("isPrintableChar", () => {
    it("recognizes space (32)", () => {
      expect(isPrintableChar(32)).toBe(true);
    });

    it("recognizes letters", () => {
      expect(isPrintableChar(65)).toBe(true);
      expect(isPrintableChar(97)).toBe(true);
    });

    it("recognizes numbers", () => {
      expect(isPrintableChar(48)).toBe(true);
      expect(isPrintableChar(57)).toBe(true);
    });

    it("recognizes tilde (126)", () => {
      expect(isPrintableChar(126)).toBe(true);
    });

    it("rejects control characters", () => {
      expect(isPrintableChar(0)).toBe(false);
      expect(isPrintableChar(31)).toBe(false);
    });

    it("rejects delete (127)", () => {
      expect(isPrintableChar(127)).toBe(false);
    });
  });
});

describe("KEY_CODES constants", () => {
  it("has correct values", () => {
    expect(KEY_CODES.CTRL_C).toBe(3);
    expect(KEY_CODES.BACKSPACE).toBe(8);
    expect(KEY_CODES.ENTER_CR).toBe(10);
    expect(KEY_CODES.ENTER_LF).toBe(13);
    expect(KEY_CODES.ESCAPE).toBe(27);
    expect(KEY_CODES.BRACKET).toBe(91);
    expect(KEY_CODES.ARROW_UP).toBe(65);
    expect(KEY_CODES.ARROW_DOWN).toBe(66);
    expect(KEY_CODES.Q).toBe(113);
    expect(KEY_CODES.DELETE).toBe(127);
    expect(KEY_CODES.PRINTABLE_START).toBe(32);
    expect(KEY_CODES.PRINTABLE_END).toBe(127);
  });
});
