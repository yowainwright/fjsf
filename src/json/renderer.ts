import { stdout } from "process";
import {
  clearScreen,
  colors,
  colorize,
  highlightMatches,
} from "../terminal.ts";
import { formatValue } from "./entry.ts";
import type { JsonEntry } from "./entry.ts";
import type { FuzzyMatch } from "../fuzzy.ts";

const MAX_VISIBLE_ITEMS = 10;

interface JsonState {
  query: string;
  selectedIndex: number;
  matches: FuzzyMatch<JsonEntry>[];
}

const formatPath = (path: string, matches: number[]): string =>
  highlightMatches(path, matches);

const formatWorkspace = (workspace: string): string => {
  const prefix = "[";
  const suffix = "]";
  const text = prefix.concat(workspace, suffix);
  return colorize(text, colors.dim);
};

const formatEntryValue = (value: unknown): string => {
  const formattedValue = formatValue(value);
  return colorize(formattedValue, colors.gray);
};

const formatPrefix = (isSelected: boolean): string => {
  const selectedPrefix = colorize("❯", colors.green);
  const unselectedPrefix = " ";
  return isSelected ? selectedPrefix : unselectedPrefix;
};

const formatJsonEntry = (
  match: FuzzyMatch<JsonEntry>,
  isSelected: boolean,
): string => {
  const item = match.item;
  const matches = match.matches;

  const prefix = formatPrefix(isSelected);
  const path = formatPath(item.path, matches);
  const workspace = formatWorkspace(item.workspace);
  const value = formatEntryValue(item.value);

  const firstLine = prefix.concat(" ", path, " ", workspace);
  const secondLine = "  ".concat(value);
  const formatted = firstLine.concat("\n", secondLine);
  return formatted;
};

const renderTitle = (title: string): string => {
  const color = colors.bright.concat(colors.cyan);
  return colorize(title, color);
};

const renderPrompt = (title: string, query: string): string => {
  const titleText = renderTitle(title);
  const searchLabel = "\n\nSearch: ";
  const prompt = titleText.concat(searchLabel, query, "\n\n");
  return prompt;
};

const renderVisibleEntries = (state: JsonState): string => {
  const visibleMatches = state.matches.slice(0, MAX_VISIBLE_ITEMS);

  const mapper = (match: FuzzyMatch<JsonEntry>, idx: number): string => {
    const isSelected = idx === state.selectedIndex;
    return formatJsonEntry(match, isSelected);
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

export const renderJsonUI = (state: JsonState, title: string): void => {
  clearScreen();

  const prompt = renderPrompt(title, state.query);
  stdout.write(prompt);

  const entries = renderVisibleEntries(state);
  stdout.write(entries);

  const moreIndicator = renderMoreIndicator(state.matches.length);
  stdout.write(moreIndicator);
};
