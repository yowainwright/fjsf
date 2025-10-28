import { fuzzySearch } from './fuzzy.ts';
import type { State } from './state.ts';

const searchableText = (state: State) => (script: typeof state.scripts[number]): string =>
  `${script.name} ${script.workspace}`;

export const updateQuery = (state: State, query: string): State => {
  const matches = fuzzySearch(state.scripts, query, searchableText(state));
  return {
    ...state,
    query,
    selectedIndex: 0,
    matches,
  };
};
