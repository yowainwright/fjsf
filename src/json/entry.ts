export interface JsonEntry {
  path: string;
  value: unknown;
  key: string;
  filePath: string;
  workspace: string;
}

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

const isObject = (value: unknown): value is JsonObject => {
  const isOfTypeObject = typeof value === "object";
  const isNotNull = value !== null;
  const isNotArray = !Array.isArray(value);
  return isOfTypeObject && isNotNull && isNotArray;
};

const isArray = (value: unknown): value is JsonArray => Array.isArray(value);

const createEntry = (
  path: string,
  value: unknown,
  key: string,
  filePath: string,
  workspace: string,
): JsonEntry => {
  const entry = Object.assign(
    {},
    {
      path,
      value,
      key,
      filePath,
      workspace,
    },
  );
  return entry;
};

const flattenObject = (
  obj: JsonObject,
  prefix: string,
  filePath: string,
  workspace: string,
): JsonEntry[] => {
  const entries = Object.entries(obj);

  const mapper = ([key, value]: [string, JsonValue]): JsonEntry[] => {
    const hasPrefix = prefix !== "";
    const fullPath = hasPrefix ? prefix.concat(".", key) : key;
    return flattenValue(value, fullPath, key, filePath, workspace);
  };

  const entriesArrays = entries.map(mapper);
  const flattened = entriesArrays.reduce((acc, curr) => acc.concat(curr), []);
  return flattened;
};

const flattenArray = (
  arr: JsonArray,
  prefix: string,
  key: string,
  filePath: string,
  workspace: string,
): JsonEntry[] => {
  const arrayEntry = createEntry(prefix, arr, key, filePath, workspace);

  const mapper = (item: JsonValue, idx: number): JsonEntry[] => {
    const indexKey = "[".concat(String(idx), "]");
    const itemPath = prefix.concat(indexKey);
    return flattenValue(item, itemPath, indexKey, filePath, workspace);
  };

  const itemEntriesArrays = arr.map(mapper);
  const itemEntries = itemEntriesArrays.reduce(
    (acc, curr) => acc.concat(curr),
    [],
  );

  const allEntries = [arrayEntry].concat(itemEntries);
  return allEntries;
};

const flattenValue = (
  value: unknown,
  path: string,
  key: string,
  filePath: string,
  workspace: string,
): JsonEntry[] => {
  const valueIsObject = isObject(value);

  if (valueIsObject) {
    const objectEntry = createEntry(path, value, key, filePath, workspace);
    const childEntries = flattenObject(value, path, filePath, workspace);
    const allEntries = [objectEntry].concat(childEntries);
    return allEntries;
  }

  const valueIsArray = isArray(value);
  if (valueIsArray) {
    return flattenArray(value, path, key, filePath, workspace);
  }

  const primitiveEntry = createEntry(path, value, key, filePath, workspace);
  return [primitiveEntry];
};

export const flattenJson = (
  json: JsonObject,
  filePath: string,
  workspace: string,
): JsonEntry[] => {
  const emptyPrefix = "";
  return flattenObject(json, emptyPrefix, filePath, workspace);
};

export const formatValue = (value: unknown): string => {
  const isString = typeof value === "string";
  if (isString) return value;

  const isNumber = typeof value === "number";
  if (isNumber) return String(value);

  const isBoolean = typeof value === "boolean";
  if (isBoolean) return String(value);

  const isNull = value === null;
  if (isNull) return "null";

  const valueIsArray = isArray(value);
  if (valueIsArray) {
    const arrayLength = value.length;
    const formattedLength = "Array(".concat(String(arrayLength), ")");
    return formattedLength;
  }

  const valueIsObject = isObject(value);
  if (valueIsObject) {
    const keys = Object.keys(value);
    const keysCount = keys.length;
    const formattedCount = "Object(".concat(String(keysCount), ")");
    return formattedCount;
  }

  return String(value);
};
