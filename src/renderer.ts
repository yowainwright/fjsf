import { stdout } from 'process';
import { clearScreen, colors, colorize, highlightMatches } from './terminal.ts';
import type { State } from './state.ts';
import type { FuzzyMatch } from './fuzzy.ts';
import type { PackageScript } from './types.ts';

const MAX_VISIBLE_ITEMS = 10;

const formatScriptName = (name: string, matches: number[]): string =>
  highlightMatches(name, matches);

const formatWorkspace = (workspace: string): string =>
  colorize(`[${workspace}]`, colors.dim);

const formatCommand = (command: string): string => colorize(command, colors.gray);

const formatPrefix = (isSelected: boolean): string =>
  isSelected ? colorize('❯', colors.green) : ' ';

const formatScript = (match: FuzzyMatch<PackageScript>, isSelected: boolean): string => {
  const { item, matches } = match;
  const prefix = formatPrefix(isSelected);
  const scriptName = formatScriptName(item.name, matches);
  const workspace = formatWorkspace(item.workspace);
  const command = formatCommand(item.command);

  return `${prefix} ${scriptName} ${workspace}\n  ${command}`;
};

const renderTitle = (): string =>
  colorize('Fuzzy NPM Scripts', colors.bright + colors.cyan);

const renderPrompt = (query: string): string =>
  `${renderTitle()}\n\nSearch: ${query}\n\n`;

const renderVisibleScripts = (state: State): string => {
  const visible = state.matches.slice(0, MAX_VISIBLE_ITEMS);
  const lines = visible.map((match, idx) => formatScript(match, idx === state.selectedIndex));
  return lines.join('\n');
};

const renderMoreIndicator = (totalCount: number): string => {
  const remaining = totalCount - MAX_VISIBLE_ITEMS;
  return remaining > 0 ? colorize(`\n\n... ${remaining} more`, colors.dim) : '';
};

export const render = (state: State): void => {
  clearScreen();
  stdout.write(renderPrompt(state.query));
  stdout.write(renderVisibleScripts(state));
  stdout.write(renderMoreIndicator(state.matches.length));
};
