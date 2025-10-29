import { stdout } from "process";
import { clearScreen, colors, colorize, highlightMatches } from "./terminal.ts";
import type { State } from "./state.ts";
import type { FuzzyMatch } from "./fuzzy.ts";
import type { PackageScript } from "./types.ts";

const MAX_VISIBLE_ITEMS = 10;

const formatScriptName = (name: string, matches: number[]): string =>
  highlightMatches(name, matches);

const formatWorkspace = (workspace: string): string => {
  const prefix = "[";
  const suffix = "]";
  const text = prefix.concat(workspace, suffix);
  return colorize(text, colors.dim);
};

const formatCommand = (command: string): string =>
  colorize(command, colors.gray);

const formatPrefix = (isSelected: boolean): string => {
  const selectedPrefix = colorize("❯", colors.green);
  const unselectedPrefix = " ";
  return isSelected ? selectedPrefix : unselectedPrefix;
};

const formatScript = (
  match: FuzzyMatch<PackageScript>,
  isSelected: boolean,
): string => {
  const item = match.item;
  const matches = match.matches;

  const prefix = formatPrefix(isSelected);
  const scriptName = formatScriptName(item.name, matches);
  const workspace = formatWorkspace(item.workspace);
  const command = formatCommand(item.command);

  const firstLine = prefix.concat(" ", scriptName, " ", workspace);
  const secondLine = "  ".concat(command);
  const formattedScript = firstLine.concat("\n", secondLine);
  return formattedScript;
};

const renderTitle = (): string => {
  const title = "Fuzzy NPM Scripts";
  const color = colors.bright.concat(colors.cyan);
  return colorize(title, color);
};

const renderPrompt = (query: string): string => {
  const title = renderTitle();
  const searchLabel = "\n\nSearch: ";
  const prompt = title.concat(searchLabel, query, "\n\n");
  return prompt;
};

const renderVisibleScripts = (state: State): string => {
  const visibleMatches = state.matches.slice(0, MAX_VISIBLE_ITEMS);
  const mapper = (match: FuzzyMatch<PackageScript>, idx: number): string => {
    const isSelected = idx === state.selectedIndex;
    return formatScript(match, isSelected);
  };
  const lines = visibleMatches.map(mapper);
  const joined = lines.join("\n");
  return joined;
};

const renderMoreIndicator = (totalCount: number): string => {
  const remaining = totalCount - MAX_VISIBLE_ITEMS;
  const hasMore = remaining > 0;

  if (hasMore) {
    const text = "\n\n... ".concat(String(remaining), " more");
    return colorize(text, colors.dim);
  }

  return "";
};

export const render = (state: State): void => {
  clearScreen();

  const prompt = renderPrompt(state.query);
  stdout.write(prompt);

  const scripts = renderVisibleScripts(state);
  stdout.write(scripts);

  const moreIndicator = renderMoreIndicator(state.matches.length);
  stdout.write(moreIndicator);
};
