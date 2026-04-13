// @ts-nocheck - QuickJS modules are not typed

type YamlObj = Record<string, unknown>;

const getIndent = (line: string): number => {
  let n = 0;
  while (n < line.length && line[n] === " ") n++;
  return n;
};

const stripYamlComment = (line: string): string => {
  let inStr = false;
  let strChar = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (!inStr && (c === '"' || c === "'")) {
      inStr = true;
      strChar = c;
    } else if (inStr && c === strChar) {
      inStr = false;
    } else if (!inStr && c === "#") {
      const before = line[i - 1];
      if (!before || before === " " || before === "\t") return line.slice(0, i).trimEnd();
    }
  }
  return line.trimEnd();
};

const splitFlow = (s: string): string[] => {
  const items: string[] = [];
  let depth = 0;
  let inStr = false;
  let strChar = "";
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!inStr && (c === '"' || c === "'")) {
      inStr = true;
      strChar = c;
    } else if (inStr && c === strChar) {
      inStr = false;
    } else if (!inStr) {
      if (c === "[" || c === "{") depth++;
      else if (c === "]" || c === "}") depth--;
      else if (depth === 0 && c === ",") {
        items.push(s.slice(start, i).trim());
        start = i + 1;
      }
    }
  }
  const last = s.slice(start).trim();
  if (last) items.push(last);
  return items.filter(Boolean);
};

const parseFlowSeq = (s: string): unknown[] => splitFlow(s).map(parseScalar);

const parseFlowMap = (s: string): YamlObj => {
  const obj: YamlObj = {};
  for (const item of splitFlow(s)) {
    const ci = item.indexOf(":");
    if (ci === -1) continue;
    obj[item.slice(0, ci).trim()] = parseScalar(item.slice(ci + 1).trim());
  }
  return obj;
};

const parseScalar = (v: string): unknown => {
  const s = v.trim();
  if (!s || s === "null" || s === "~") return null;
  if (s === "true") return true;
  if (s === "false") return false;
  if (s.startsWith('"') && s.endsWith('"'))
    return s
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith("[") && s.endsWith("]")) return parseFlowSeq(s.slice(1, -1));
  if (s.startsWith("{") && s.endsWith("}")) return parseFlowMap(s.slice(1, -1));
  const n = Number(s);
  if (!isNaN(n) && s !== "") return n;
  return s;
};

const findYamlColon = (text: string): number => {
  let inStr = false;
  let strChar = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!inStr && (c === '"' || c === "'")) {
      inStr = true;
      strChar = c;
    } else if (inStr && c === strChar) {
      inStr = false;
    } else if (!inStr && c === ":") {
      const next = text[i + 1];
      if (next === undefined || next === " " || next === "\t") return i;
    }
  }
  return -1;
};

const BLOCK_SCALARS = new Set(["|", "|-", "|+", ">", ">-", ">+"]);

type Frame =
  | { kind: "obj"; indent: number; obj: YamlObj; lastKey: string | null }
  | {
      kind: "arr";
      indent: number;
      arr: unknown[];
      parent: YamlObj;
      parentKey: string;
    }
  | { kind: "pending"; indent: number; parent: YamlObj; key: string };

export const parseYaml = (content: string): Record<string, unknown> | null => {
  try {
    const root: YamlObj = {};
    const stack: Frame[] = [{ kind: "obj", indent: -1, obj: root, lastKey: null }];
    const lines = content.split("\n");
    let i = 0;

    const materialize = (type: "obj" | "arr"): void => {
      const top = stack[stack.length - 1];
      if (top.kind !== "pending") return;
      if (type === "arr") {
        const arr: unknown[] = [];
        top.parent[top.key] = arr;
        stack.pop();
        stack.push({
          kind: "arr",
          indent: top.indent,
          arr,
          parent: top.parent,
          parentKey: top.key,
        });
      } else {
        const obj: YamlObj = {};
        top.parent[top.key] = obj;
        stack.pop();
        stack.push({ kind: "obj", indent: top.indent, obj, lastKey: null });
      }
    };

    const popToIndent = (indent: number): void => {
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
    };

    while (i < lines.length) {
      const raw = lines[i++];
      const stripped = stripYamlComment(raw);
      if (!stripped.trim()) continue;
      const trimmed = stripped.trimStart();
      if (trimmed.startsWith("---") || trimmed.startsWith("...")) continue;

      const indent = getIndent(stripped);
      const text = stripped.slice(indent);

      popToIndent(indent);

      const top = stack[stack.length - 1];

      if (text.startsWith("- ") || text === "-") {
        const value = text.slice(2).trim();

        if (top.kind === "pending") materialize("arr");

        const arrTop = stack[stack.length - 1];

        if (arrTop.kind === "obj" && arrTop.lastKey) {
          const arr: unknown[] = [];
          arrTop.obj[arrTop.lastKey] = arr;
          stack.push({
            kind: "arr",
            indent: indent - 1,
            arr,
            parent: arrTop.obj,
            parentKey: arrTop.lastKey,
          });
        }

        const seqTop = stack[stack.length - 1];
        if (seqTop.kind !== "arr") continue;

        if (!value) {
          const newObj: YamlObj = {};
          seqTop.arr.push(newObj);
          stack.push({ kind: "obj", indent, obj: newObj, lastKey: null });
          continue;
        }

        const ci = findYamlColon(value);
        if (ci !== -1) {
          const k = value
            .slice(0, ci)
            .trim()
            .replace(/^["']|["']$/g, "");
          const v = value.slice(ci + 1).trim();
          const newObj: YamlObj = {};
          seqTop.arr.push(newObj);
          if (v) {
            newObj[k] = parseScalar(v);
            stack.push({ kind: "obj", indent, obj: newObj, lastKey: k });
          } else {
            stack.push({ kind: "pending", indent, parent: newObj, key: k });
          }
        } else {
          seqTop.arr.push(parseScalar(value));
        }
      } else {
        if (top.kind === "pending") materialize("obj");

        const objTop = stack[stack.length - 1];
        if (objTop.kind !== "obj") continue;

        const ci = findYamlColon(text);
        if (ci === -1) continue;

        const key = text
          .slice(0, ci)
          .trim()
          .replace(/^["']|["']$/g, "");
        const value = text.slice(ci + 1).trim();

        if (BLOCK_SCALARS.has(value)) {
          let blockContent = "";
          let blockIndent = -1;
          while (i < lines.length) {
            const bl = lines[i];
            if (bl.trim() === "") {
              blockContent += "\n";
              i++;
              continue;
            }
            const bi = getIndent(bl);
            if (blockIndent === -1) blockIndent = bi;
            if (bi <= indent) break;
            blockContent += bl.slice(blockIndent) + "\n";
            i++;
          }
          objTop.obj[key] = blockContent.trimEnd();
        } else if (!value) {
          stack.push({ kind: "pending", indent, parent: objTop.obj, key });
        } else {
          objTop.obj[key] = parseScalar(value);
        }
        objTop.lastKey = key;
      }
    }

    return root;
  } catch {
    return null;
  }
};
