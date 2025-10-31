import { stdout } from "process";
import { colors, colorize, highlightMatches } from "../terminal.ts";
import type { State } from "../state.ts";
import type { FuzzyMatch } from "../fuzzy.ts";
import type { PackageScript } from "../types.ts";

const MAX_VISIBLE_ITEMS = 8;

const saveCursor = (): void => {
  stdout.write("\x1b[s");
};

const restoreCursor = (): void => {
  stdout.write("\x1b[u");
};

const clearLine = (): void => {
  stdout.write("\x1b[2K");
};

const moveUp = (): void => {
  stdout.write("\x1b[1A");
};

const clearTooltip = (lines: number): void => {
  for (let i = 0; i < lines; i++) {
    clearLine();
    moveUp();
  }
  clearLine();
};

const formatScriptName = (name: string, matches: number[]): string =>
  highlightMatches(name, matches);

const formatWorkspace = (workspace: string): string => {
  const text = `[${workspace}]`;
  return colorize(text, colors.dim);
};

const formatPrefix = (isSelected: boolean): string => {
  return isSelected ? colorize("❯", colors.green) : " ";
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
  return `${prefix} ${scriptName} ${workspace}`;
};

const renderTooltipContent = (state: State): void => {
  const selectedIndex = state.selectedIndex;
  const totalMatches = state.matches.length;

  if (totalMatches === 0) {
    const noMatches = colorize("No matches", colors.dim);
    stdout.write(`\n${noMatches}`);
    return;
  }

  const halfWindow = Math.floor(MAX_VISIBLE_ITEMS / 2);
  let startIndex = Math.max(0, selectedIndex - halfWindow);
  const endIndex = Math.min(totalMatches, startIndex + MAX_VISIBLE_ITEMS);
  const actualVisible = endIndex - startIndex;

  if (actualVisible < MAX_VISIBLE_ITEMS && totalMatches >= MAX_VISIBLE_ITEMS) {
    startIndex = Math.max(0, endIndex - MAX_VISIBLE_ITEMS);
  }

  const visibleMatches = state.matches.slice(startIndex, endIndex);

  for (let idx = 0; idx < visibleMatches.length; idx++) {
    const match = visibleMatches[idx];
    if (!match) continue;
    const absoluteIndex = startIndex + idx;
    const isSelected = absoluteIndex === selectedIndex;
    const line = formatScript(match, isSelected);
    stdout.write(`\n${line}`);
  }

  const remaining = totalMatches - MAX_VISIBLE_ITEMS;
  if (remaining > 0) {
    const more = colorize(`\n... ${remaining} more`, colors.dim);
    stdout.write(more);
  }
};

const calculateLineCount = (state: State): number => {
  if (state.matches.length === 0) return 1;

  const visibleCount = Math.min(MAX_VISIBLE_ITEMS, state.matches.length);
  const hasMore = state.matches.length > MAX_VISIBLE_ITEMS;
  return visibleCount + (hasMore ? 1 : 0);
};

let lastLineCount = 0;

export const renderTooltip = (state: State): void => {
  saveCursor();

  if (lastLineCount > 0) {
    clearTooltip(lastLineCount);
  }

  renderTooltipContent(state);
  lastLineCount = calculateLineCount(state);

  restoreCursor();
};

export const clearTooltipFinal = (): void => {
  if (lastLineCount > 0) {
    saveCursor();
    clearTooltip(lastLineCount);
    restoreCursor();
  }
};
