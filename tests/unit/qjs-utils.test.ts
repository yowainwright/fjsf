import { describe, it, expect } from "bun:test";
import { parseToml } from "../../src/parsers/toml";
import { parseYaml } from "../../src/parsers/yaml";

const join = (...parts: (string | undefined | null)[]): string =>
  parts.filter(Boolean).join("/").replace(/\/+/g, "/");

const relative = (from: string, to: string): string => {
  const isSubPath = to.startsWith(from) && (to[from.length] === "/" || from.length === to.length);
  if (isSubPath) {
    const rel = to.slice(from.length);
    return rel.startsWith("/") ? rel.slice(1) : rel;
  }
  return to;
};

const toAbsolutePath = (cwd: string, filePath: string): string =>
  filePath.startsWith("/") ? filePath : join(cwd, filePath);

const isSkippableEntry = (entry: string): boolean =>
  entry === "node_modules" || entry.startsWith(".");

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
    const selfEntry = createEntry(path, `Array(${value.length})`, key, filePath, workspace);
    const childEntries = value.flatMap((item, i) =>
      flattenValue(item, `${path}[${i}]`, `[${i}]`, filePath, workspace),
    );
    return [selfEntry, ...childEntries];
  }

  const isObject = typeof value === "object";
  if (isObject) {
    const keys = Object.keys(value as Record<string, unknown>);
    const selfEntry = createEntry(path, `Object(${keys.length})`, key, filePath, workspace);
    const childEntries = keys.flatMap((k) => {
      const newPath = path ? `${path}.${k}` : k;
      return flattenValue((value as Record<string, unknown>)[k], newPath, k, filePath, workspace);
    });
    return [selfEntry, ...childEntries];
  }

  return [createEntry(path, String(value), key, filePath, workspace)];
};

const flattenJson = (
  obj: Record<string, unknown>,
  filePath: string,
  workspace: string,
): JsonEntry[] => Object.keys(obj).flatMap((k) => flattenValue(obj[k], k, k, filePath, workspace));

type FileFormat = "json" | "toml" | "yaml" | "unknown";

const CONFIG_EXTENSIONS: Record<string, FileFormat> = {
  json: "json",
  toml: "toml",
  yaml: "yaml",
  yml: "yaml",
};

const detectFileFormat = (filePath: string): FileFormat => {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return CONFIG_EXTENSIONS[ext] ?? "unknown";
};

const SCRIPT_KEYS = ["scripts", "tasks", "jobs"];

const extractScripts = (
  obj: Record<string, unknown>,
  filePath: string,
  workspace: string,
): JsonEntry[] => {
  const fromCurrentLevel = SCRIPT_KEYS.filter(
    (key) => key in obj && obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key]),
  ).flatMap((key) => {
    const section = obj[key] as Record<string, unknown>;
    return Object.entries(section)
      .filter(([, value]) => typeof value === "string")
      .map(([name, value]) => ({
        path: name,
        value: value as string,
        key: name,
        filePath,
        workspace,
      }));
  });

  const fromNested = Object.entries(obj)
    .filter(
      ([key, value]) =>
        !SCRIPT_KEYS.includes(key) && value && typeof value === "object" && !Array.isArray(value),
    )
    .flatMap(([, value]) => extractScripts(value as Record<string, unknown>, filePath, workspace));

  return [...fromCurrentLevel, ...fromNested];
};

const createDefaultOptions = () => ({
  help: false,
  version: false,
  quit: false,
  mode: "default" as "default" | "find" | "path",
  filePath: undefined as string | undefined,
});

const isHelpArg = (arg: string): boolean => ["help", "h", "--help", "-h"].includes(arg);

const isVersionArg = (arg: string): boolean => ["--version", "-v"].includes(arg);

const isQuitArg = (arg: string): boolean => ["quit", "q"].includes(arg);

const isFindArg = (arg: string): boolean => ["find", "f"].includes(arg);

const isPathArg = (arg: string): boolean => ["path", "p"].includes(arg);

const hasNextArg = (args: string[], i: number): boolean => i + 1 < args.length;

const getNextArg = (args: string[], i: number): string | undefined =>
  hasNextArg(args, i) ? args[i + 1] : undefined;

const KEY_CODES = {
  CTRL_C: 3,
  BACKSPACE: 8,
  ENTER_LF: 10,
  ENTER_CR: 13,
  ESCAPE: 27,
  BRACKET: 91,
  BRACKET_APP: 79,
  ARROW_UP: 65,
  ARROW_DOWN: 66,
  Q: 113,
  DELETE: 127,
  PRINTABLE_START: 32,
  PRINTABLE_END: 127,
};

const isHardExit = (byte0: number, key: Uint8Array): boolean => {
  const isCtrlC = byte0 === KEY_CODES.CTRL_C;
  const isEscape = byte0 === KEY_CODES.ESCAPE && key.length === 1;
  return isCtrlC || isEscape;
};

const isEnterKey = (byte0: number): boolean =>
  byte0 === KEY_CODES.ENTER_CR || byte0 === KEY_CODES.ENTER_LF;

const isArrowSequence = (byte0: number, key: Uint8Array): boolean => {
  const isEscape = byte0 === KEY_CODES.ESCAPE;
  const hasEnoughBytes = key.length >= 3;
  const isNormalMode = key[1] === KEY_CODES.BRACKET;
  const isAppMode = key[1] === KEY_CODES.BRACKET_APP;
  return isEscape && hasEnoughBytes && (isNormalMode || isAppMode);
};

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code < 0xdc00;

const isLowSurrogate = (code: number): boolean => code >= 0xdc00 && code < 0xe000;

const decodeSurrogatePair = (high: number, low: number): number =>
  ((high - 0xd800) << 10) + (low - 0xdc00) + 0x10000;

const encodeOneByteChar = (code: number): number[] => [code];

const encodeTwoByteChar = (code: number): number[] => [0xc0 | (code >> 6), 0x80 | (code & 0x3f)];

const encodeThreeByteChar = (code: number): number[] => [
  0xe0 | (code >> 12),
  0x80 | ((code >> 6) & 0x3f),
  0x80 | (code & 0x3f),
];

const encodeFourByteChar = (code: number): number[] => [
  0xf0 | (code >> 18),
  0x80 | ((code >> 12) & 0x3f),
  0x80 | ((code >> 6) & 0x3f),
  0x80 | (code & 0x3f),
];

const stringToUtf8 = (str: string): Uint8Array => {
  const bytes: number[] = [];
  let i = 0;

  while (i < str.length) {
    const code = str.charCodeAt(i);
    const nextCode = str.charCodeAt(i + 1);
    const isSurrogatePair = isHighSurrogate(code) && isLowSurrogate(nextCode);

    if (code < 0x80) {
      bytes.push(...encodeOneByteChar(code));
    } else if (code < 0x800) {
      bytes.push(...encodeTwoByteChar(code));
    } else if (isSurrogatePair) {
      bytes.push(...encodeFourByteChar(decodeSurrogatePair(code, nextCode)));
      i++;
    } else {
      bytes.push(...encodeThreeByteChar(code));
    }

    i++;
  }

  return new Uint8Array(bytes);
};

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

    it("does not match /a/bc as subpath of /a/b", () => {
      expect(relative("/a/b", "/a/bc/d")).toBe("/a/bc/d");
    });
  });

  describe("toAbsolutePath", () => {
    it("returns path unchanged if already absolute", () => {
      expect(toAbsolutePath("/cwd", "/absolute/path")).toBe("/absolute/path");
    });

    it("joins cwd with relative path", () => {
      expect(toAbsolutePath("/cwd", "relative/path")).toBe("/cwd/relative/path");
    });

    it("handles current directory", () => {
      expect(toAbsolutePath("/home/user", "file.txt")).toBe("/home/user/file.txt");
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
      const entry = createEntry("path.to.key", "value", "key", "file.json", "workspace");
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
      const entries = flattenValue({ a: 1, b: 2 }, "obj", "obj", "file.json", "ws");
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
      const entries = flattenJson(obj, "file.json", "ws");
      expect(entries.some((e) => e.path === "name")).toBe(true);
      expect(entries.some((e) => e.path === "version")).toBe(true);
    });
  });
});

describe("Format detection", () => {
  describe("detectFileFormat", () => {
    it("detects JSON by extension", () => {
      expect(detectFileFormat("package.json")).toBe("json");
      expect(detectFileFormat("/path/to/config.json")).toBe("json");
    });

    it("detects TOML by extension", () => {
      expect(detectFileFormat("Cargo.toml")).toBe("toml");
      expect(detectFileFormat("pyproject.toml")).toBe("toml");
    });

    it("detects YAML by .yaml extension", () => {
      expect(detectFileFormat("docker-compose.yaml")).toBe("yaml");
    });

    it("detects YAML by .yml extension", () => {
      expect(detectFileFormat(".github/workflows/ci.yml")).toBe("yaml");
    });

    it("returns unknown for unrecognized extensions", () => {
      expect(detectFileFormat("file.txt")).toBe("unknown");
      expect(detectFileFormat("Makefile")).toBe("unknown");
    });
  });
});

describe("TOML parser", () => {
  it("parses simple key-value pairs", () => {
    const result = parseToml('name = "fjsf"\nversion = "1.0.0"');
    expect(result).toEqual({ name: "fjsf", version: "1.0.0" });
  });

  it("parses integers and booleans", () => {
    const result = parseToml("port = 8080\ndebug = true\nverbose = false");
    expect(result).toEqual({ port: 8080, debug: true, verbose: false });
  });

  it("parses table headers", () => {
    const result = parseToml('[scripts]\nbuild = "npm run build"\ntest = "npm test"');
    expect(result).toEqual({ scripts: { build: "npm run build", test: "npm test" } });
  });

  it("parses nested table paths", () => {
    const result = parseToml('[tool.taskipy.tasks]\nbuild = "python setup.py build"');
    expect(result?.tool).toEqual({ taskipy: { tasks: { build: "python setup.py build" } } });
  });

  it("parses inline arrays", () => {
    const result = parseToml('features = ["serde", "json"]');
    expect(result).toEqual({ features: ["serde", "json"] });
  });

  it("parses inline tables", () => {
    const result = parseToml('author = { name = "Alice", email = "alice@example.com" }');
    expect(result?.author).toEqual({ name: "Alice", email: "alice@example.com" });
  });

  it("ignores comments", () => {
    const result = parseToml('# This is a comment\nname = "test" # inline comment');
    expect(result).toEqual({ name: "test" });
  });

  it("parses array tables [[key]]", () => {
    const content =
      '[[bin]]\nname = "fjsf"\npath = "src/main.rs"\n\n[[bin]]\nname = "fjsf-alt"\npath = "src/alt.rs"';
    const result = parseToml(content);
    expect(Array.isArray(result?.bin)).toBe(true);
    expect((result?.bin as unknown[]).length).toBe(2);
  });

  it("parses literal strings without escape processing", () => {
    const result = parseToml("path = 'C:\\\\Users\\\\foo'");
    expect(result?.path).toBe("C:\\\\Users\\\\foo");
  });

  it("returns null for truly invalid content", () => {
    expect(parseToml(null as unknown as string)).toBe(null);
  });

  it("parses Cargo.toml-like structure", () => {
    const content = `[package]
name = "my-crate"
version = "0.1.0"

[scripts]
build = "cargo build"
test = "cargo test"
`;
    const result = parseToml(content);
    expect(result?.package).toEqual({ name: "my-crate", version: "0.1.0" });
    expect(result?.scripts).toEqual({ build: "cargo build", test: "cargo test" });
  });
});

describe("YAML parser", () => {
  it("parses simple key-value pairs", () => {
    const result = parseYaml("name: fjsf\nversion: 1.0.0");
    expect(result?.name).toBe("fjsf");
    expect(result?.version).toBe("1.0.0");
  });

  it("parses nested objects", () => {
    const content = "scripts:\n  build: npm run build\n  test: npm test";
    const result = parseYaml(content);
    expect(result?.scripts).toEqual({ build: "npm run build", test: "npm test" });
  });

  it("parses sequences", () => {
    const content = "items:\n  - one\n  - two\n  - three";
    const result = parseYaml(content);
    expect(result?.items).toEqual(["one", "two", "three"]);
  });

  it("parses sequences of objects", () => {
    const content =
      "steps:\n  - name: Run tests\n    run: npm test\n  - name: Build\n    run: npm run build";
    const result = parseYaml(content);
    const steps = result?.steps as Record<string, string>[];
    expect(steps).toHaveLength(2);
    expect(steps[0]!.name).toBe("Run tests");
    expect(steps[0]!.run).toBe("npm test");
    expect(steps[1]!.run).toBe("npm run build");
  });

  it("parses booleans", () => {
    const result = parseYaml("enabled: true\ndisabled: false");
    expect(result?.enabled).toBe(true);
    expect(result?.disabled).toBe(false);
  });

  it("parses null values", () => {
    const result = parseYaml("value: null\nother: ~");
    expect(result?.value).toBe(null);
    expect(result?.other).toBe(null);
  });

  it("parses numbers", () => {
    const result = parseYaml("port: 8080\nratio: 0.5");
    expect(result?.port).toBe(8080);
    expect(result?.ratio).toBe(0.5);
  });

  it("ignores comments", () => {
    const result = parseYaml("# comment\nname: test # inline");
    expect(result?.name).toBe("test");
  });

  it("skips document separators", () => {
    const result = parseYaml("---\nname: test");
    expect(result?.name).toBe("test");
  });

  it("parses quoted strings", () => {
    const result = parseYaml("name: \"hello world\"\nother: 'single quoted'");
    expect(result?.name).toBe("hello world");
    expect(result?.other).toBe("single quoted");
  });

  it("parses GitHub Actions-like structure", () => {
    const content = `jobs:
  build:
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: Run tests
        run: npm test
`;
    const result = parseYaml(content);
    const build = (result?.jobs as Record<string, unknown>)?.build as Record<string, unknown>;
    const steps = build?.steps as Record<string, string>[];
    expect(steps).toHaveLength(2);
    expect(steps[1]!.run).toBe("npm test");
  });

  it("returns null on parse error", () => {
    expect(parseYaml(null as unknown as string)).toBe(null);
  });
});

describe("Script extraction", () => {
  describe("extractScripts", () => {
    it("extracts scripts section", () => {
      const obj = { scripts: { build: "npm run build", test: "npm test" } };
      const entries = extractScripts(obj, "package.json", "my-pkg");
      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.path === "build")?.value).toBe("npm run build");
      expect(entries.find((e) => e.path === "test")?.value).toBe("npm test");
    });

    it("extracts tasks section", () => {
      const obj = { tasks: { compile: "tsc", lint: "eslint ." } };
      const entries = extractScripts(obj, "Cargo.toml", "my-crate");
      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.path === "compile")?.value).toBe("tsc");
    });

    it("extracts jobs section", () => {
      const obj = { jobs: { deploy: "kubectl apply -f .", test: "pytest" } };
      const entries = extractScripts(obj, "ci.yml", "ci");
      expect(entries).toHaveLength(2);
    });

    it("skips non-string values in script sections", () => {
      const obj = { scripts: { build: "tsc", config: { nested: "ignored" } } };
      const entries = extractScripts(obj, "file.json", "ws");
      expect(entries).toHaveLength(1);
      expect(entries[0]!.path).toBe("build");
    });

    it("returns empty array when no known sections", () => {
      const obj = { name: "test", version: "1.0.0" };
      const entries = extractScripts(obj, "file.json", "ws");
      expect(entries).toHaveLength(0);
    });

    it("extracts scripts from nested paths like tool.taskipy.tasks", () => {
      const obj = { tool: { taskipy: { tasks: { build: "python setup.py build" } } } };
      const entries = extractScripts(obj, "pyproject.toml", "my-pkg");
      expect(entries).toHaveLength(1);
      expect(entries[0]!.path).toBe("build");
      expect(entries[0]!.value).toBe("python setup.py build");
    });

    it("sets correct filePath and workspace on entries", () => {
      const obj = { scripts: { build: "tsc" } };
      const entries = extractScripts(obj, "packages/core/package.json", "@core/pkg");
      expect(entries[0]!.filePath).toBe("packages/core/package.json");
      expect(entries[0]!.workspace).toBe("@core/pkg");
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
      expect(opts.mode).toBe("default");
      expect(opts.filePath).toBe(undefined);
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
  describe("isHardExit", () => {
    it("recognizes Ctrl+C", () => {
      expect(isHardExit(3, new Uint8Array([3]))).toBe(true);
    });

    it("recognizes Escape (single byte)", () => {
      expect(isHardExit(27, new Uint8Array([27]))).toBe(true);
    });

    it("does not treat q as hard exit", () => {
      expect(isHardExit(113, new Uint8Array([113]))).toBe(false);
    });

    it("does not treat escape sequence as exit", () => {
      expect(isHardExit(27, new Uint8Array([27, 91, 65]))).toBe(false);
    });

    it("rejects other keys", () => {
      expect(isHardExit(65, new Uint8Array([65]))).toBe(false);
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
    expect(KEY_CODES.ENTER_LF).toBe(10);
    expect(KEY_CODES.ENTER_CR).toBe(13);
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

describe("UTF-8 encoding utilities", () => {
  describe("isHighSurrogate", () => {
    it("returns true for high surrogates (0xD800-0xDBFF)", () => {
      expect(isHighSurrogate(0xd800)).toBe(true);
      expect(isHighSurrogate(0xdbff)).toBe(true);
    });

    it("returns false for non-surrogates", () => {
      expect(isHighSurrogate(0xd7ff)).toBe(false);
      expect(isHighSurrogate(0xdc00)).toBe(false);
      expect(isHighSurrogate(65)).toBe(false);
    });
  });

  describe("isLowSurrogate", () => {
    it("returns true for low surrogates (0xDC00-0xDFFF)", () => {
      expect(isLowSurrogate(0xdc00)).toBe(true);
      expect(isLowSurrogate(0xdfff)).toBe(true);
    });

    it("returns false for non-surrogates", () => {
      expect(isLowSurrogate(0xdbff)).toBe(false);
      expect(isLowSurrogate(0xe000)).toBe(false);
      expect(isLowSurrogate(65)).toBe(false);
    });
  });

  describe("decodeSurrogatePair", () => {
    it("decodes emoji surrogate pair", () => {
      const result = decodeSurrogatePair(0xd83d, 0xde00);
      expect(result).toBe(0x1f600);
    });

    it("decodes first valid code point", () => {
      const result = decodeSurrogatePair(0xd800, 0xdc00);
      expect(result).toBe(0x10000);
    });
  });

  describe("encodeOneByteChar", () => {
    it("encodes ASCII character", () => {
      expect(encodeOneByteChar(65)).toEqual([65]);
      expect(encodeOneByteChar(0)).toEqual([0]);
      expect(encodeOneByteChar(127)).toEqual([127]);
    });
  });

  describe("encodeTwoByteChar", () => {
    it("encodes two-byte character", () => {
      expect(encodeTwoByteChar(0x80)).toEqual([0xc2, 0x80]);
      expect(encodeTwoByteChar(0x7ff)).toEqual([0xdf, 0xbf]);
    });
  });

  describe("encodeThreeByteChar", () => {
    it("encodes three-byte character", () => {
      expect(encodeThreeByteChar(0x800)).toEqual([0xe0, 0xa0, 0x80]);
      expect(encodeThreeByteChar(0xffff)).toEqual([0xef, 0xbf, 0xbf]);
    });
  });

  describe("encodeFourByteChar", () => {
    it("encodes four-byte character (emoji)", () => {
      expect(encodeFourByteChar(0x1f600)).toEqual([0xf0, 0x9f, 0x98, 0x80]);
    });

    it("encodes first four-byte code point", () => {
      expect(encodeFourByteChar(0x10000)).toEqual([0xf0, 0x90, 0x80, 0x80]);
    });
  });

  describe("stringToUtf8", () => {
    it("encodes ASCII string", () => {
      const result = stringToUtf8("hello");
      expect(result).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
    });

    it("encodes empty string", () => {
      const result = stringToUtf8("");
      expect(result).toEqual(new Uint8Array([]));
    });

    it("encodes two-byte characters", () => {
      const result = stringToUtf8("é");
      expect(result).toEqual(new Uint8Array([0xc3, 0xa9]));
    });

    it("encodes three-byte characters", () => {
      const result = stringToUtf8("中");
      expect(result).toEqual(new Uint8Array([0xe4, 0xb8, 0xad]));
    });

    it("encodes four-byte characters (emoji)", () => {
      const result = stringToUtf8("😀");
      expect(result).toEqual(new Uint8Array([0xf0, 0x9f, 0x98, 0x80]));
    });

    it("encodes mixed ASCII and multi-byte", () => {
      const result = stringToUtf8("a中b");
      expect(result).toEqual(new Uint8Array([97, 0xe4, 0xb8, 0xad, 98]));
    });

    it("matches TextEncoder output", () => {
      const encoder = new TextEncoder();
      const testStrings = ["hello", "中文", "emoji 😀", "café", ""];

      for (const str of testStrings) {
        expect(stringToUtf8(str)).toEqual(encoder.encode(str));
      }
    });
  });
});

describe("Application cursor mode", () => {
  describe("isArrowSequence with app mode", () => {
    it("recognizes application cursor mode up arrow (ESC O A)", () => {
      const key = new Uint8Array([27, 79, 65]);
      expect(isArrowSequence(27, key)).toBe(true);
    });

    it("recognizes application cursor mode down arrow (ESC O B)", () => {
      const key = new Uint8Array([27, 79, 66]);
      expect(isArrowSequence(27, key)).toBe(true);
    });

    it("handles both normal mode (ESC [ A) and app mode (ESC O A)", () => {
      const normalUp = new Uint8Array([27, 91, 65]);
      const appUp = new Uint8Array([27, 79, 65]);

      expect(isArrowSequence(27, normalUp)).toBe(true);
      expect(isArrowSequence(27, appUp)).toBe(true);
    });
  });
});
