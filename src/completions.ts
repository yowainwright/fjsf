import { stdout } from "process";
import { discoverScripts } from "./discover.ts";
import type { PackageScript } from "./types.ts";

const fuzzyMatch = (query: string, text: string): boolean => {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  const queryIndex = [...lowerText].reduce((index, char) => {
    const isMatch = index < lowerQuery.length && char === lowerQuery[index];
    return isMatch ? index + 1 : index;
  }, 0);

  return queryIndex === lowerQuery.length;
};

const filterScript =
  (query: string) =>
  (script: PackageScript): boolean => {
    const nameMatches = fuzzyMatch(query, script.name);
    const workspaceMatches = fuzzyMatch(query, script.workspace);
    return nameMatches || workspaceMatches;
  };

const filterScripts = (
  scripts: PackageScript[],
  query: string,
): PackageScript[] => {
  if (!query) return scripts;
  return scripts.filter(filterScript(query));
};

const formatScriptForCompletion = (script: PackageScript): string => {
  const description = `[${script.workspace}] ${script.command}`;
  return `${script.name}:${description}`;
};

export const runCompletions = (query?: string): void => {
  const scripts = discoverScripts();
  const filteredScripts = filterScripts(scripts, query || "");

  const formattedScripts = filteredScripts.map(formatScriptForCompletion);
  const output = formattedScripts.join("\n");

  stdout.write(output);
};
