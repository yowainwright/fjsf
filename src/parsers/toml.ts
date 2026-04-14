// @ts-nocheck - QuickJS modules are not typed

type TomlObj = Record<string, unknown>;

const stripTomlComment = (line: string): string => {
  let inStr = false;
  let strChar = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const prev = line[i - 1] ?? "";
    if (!inStr && (c === '"' || c === "'")) {
      inStr = true;
      strChar = c;
    } else if (inStr && c === strChar && prev !== "\\") {
      inStr = false;
    } else if (!inStr && c === "#") {
      return line.slice(0, i);
    }
  }
  return line;
};

const parseTomlString = (s: string): string =>
  s
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, '"');

const splitTomlList = (content: string): string[] => {
  const items: string[] = [];
  let depth = 0;
  let inStr = false;
  let strChar = "";
  let start = 0;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const prev = content[i - 1] ?? "";
    if (!inStr && (c === '"' || c === "'")) {
      inStr = true;
      strChar = c;
    } else if (inStr && c === strChar && prev !== "\\") {
      inStr = false;
    } else if (!inStr) {
      if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") depth--;
      else if (depth === 0 && c === ",") {
        items.push(content.slice(start, i).trim());
        start = i + 1;
      }
    }
  }
  const last = content.slice(start).trim();
  if (last) items.push(last);
  return items.filter(Boolean);
};

const parseTomlArray = (content: string): unknown[] => splitTomlList(content).map(parseTomlValue);

const parseTomlInlineTable = (content: string): TomlObj => {
  const obj: TomlObj = {};
  for (const pair of splitTomlList(content)) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    obj[pair.slice(0, eq).trim()] = parseTomlValue(pair.slice(eq + 1).trim());
  }
  return obj;
};

const parseTomlValue = (raw: string): unknown => {
  const s = raw.trim();
  if (s === "true") return true;
  if (s === "false") return false;
  if (s.startsWith('"""') && s.endsWith('"""')) return s.slice(3, -3);
  if (s.startsWith("'''") && s.endsWith("'''")) return s.slice(3, -3);
  if (s.startsWith('"') && s.endsWith('"')) return parseTomlString(s.slice(1, -1));
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  if (s.startsWith("[") && s.endsWith("]")) return parseTomlArray(s.slice(1, -1));
  if (s.startsWith("{") && s.endsWith("}")) return parseTomlInlineTable(s.slice(1, -1));
  const num = Number(s.replace(/_/g, ""));
  if (!isNaN(num) && s !== "") return num;
  return s;
};

const getOrCreate = (root: TomlObj, path: string[]): TomlObj => {
  let cur = root;
  for (const key of path) {
    if (!(key in cur)) cur[key] = {};
    const next = cur[key];
    if (Array.isArray(next)) cur = next[next.length - 1] as TomlObj;
    else if (next && typeof next === "object") cur = next as TomlObj;
    else {
      cur[key] = {};
      cur = cur[key] as TomlObj;
    }
  }
  return cur;
};

const findEq = (line: string): number => {
  let inStr = false;
  let strChar = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const prev = line[i - 1] ?? "";
    if (!inStr && (c === '"' || c === "'")) {
      inStr = true;
      strChar = c;
    } else if (inStr && c === strChar && prev !== "\\") {
      inStr = false;
    } else if (!inStr && c === "=") {
      return i;
    }
  }
  return -1;
};

const collectMultiline = (
  lines: string[],
  start: number,
  delim: string,
): { value: string; nextIndex: number } => {
  let collected = "";
  let i = start;
  while (i < lines.length) {
    const nl = lines[i++];
    const endPos = nl.indexOf(delim);
    if (endPos !== -1) {
      collected += nl.slice(0, endPos);
      break;
    }
    collected += nl + "\n";
  }
  return { value: collected, nextIndex: i };
};

export const parseToml = (content: string): Record<string, unknown> | null => {
  try {
    const result: TomlObj = {};
    const lines = content.split("\n");
    let cur = result;
    let i = 0;

    while (i < lines.length) {
      const rawLine = lines[i++];
      const line = stripTomlComment(rawLine).trim();
      if (!line) continue;

      if (line.startsWith("[[") && line.endsWith("]]")) {
        const keyPath = line.slice(2, -2).trim().split(".");
        const parent = getOrCreate(result, keyPath.slice(0, -1));
        const lastKey = keyPath[keyPath.length - 1];
        if (!Array.isArray(parent[lastKey])) parent[lastKey] = [];
        const newObj: TomlObj = {};
        (parent[lastKey] as TomlObj[]).push(newObj);
        cur = newObj;
        continue;
      }

      if (line.startsWith("[") && line.endsWith("]") && !line.startsWith("[[")) {
        const keyPath = line.slice(1, -1).trim().split(".");
        cur = getOrCreate(result, keyPath);
        continue;
      }

      const eqIdx = findEq(line);
      if (eqIdx === -1) continue;

      const key = line.slice(0, eqIdx).trim();
      const rawVal = line.slice(eqIdx + 1).trim();

      if (rawVal.startsWith('"""')) {
        const after = rawVal.slice(3);
        const closeIdx = after.indexOf('"""');
        if (closeIdx !== -1) {
          cur[key] = after.slice(0, closeIdx);
          continue;
        }
        const result2 = collectMultiline(lines, i, '"""');
        cur[key] = after + "\n" + result2.value;
        i = result2.nextIndex;
        continue;
      }

      if (rawVal.startsWith("'''")) {
        const after = rawVal.slice(3);
        const closeIdx = after.indexOf("'''");
        if (closeIdx !== -1) {
          cur[key] = after.slice(0, closeIdx);
          continue;
        }
        const result2 = collectMultiline(lines, i, "'''");
        cur[key] = after + "\n" + result2.value;
        i = result2.nextIndex;
        continue;
      }

      cur[key] = parseTomlValue(rawVal);
    }

    return result;
  } catch {
    return null;
  }
};
