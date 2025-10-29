import { fuzzySearch } from "./fuzzy.ts";
import type { State } from "./state.ts";

const searchableText =
  (state: State) =>
  (script: (typeof state.scripts)[number]): string => {
    const name = script.name;
    const workspace = script.workspace;
    const combined = name.concat(" ", workspace);
    return combined;
  };

export const updateQuery = (state: State, query: string): State => {
  const textExtractor = searchableText(state);
  const scripts = state.scripts;
  const matches = fuzzySearch(scripts, query, textExtractor);

  const resetIndex = 0;
  const updatedState = Object.assign({}, state, {
    query,
    selectedIndex: resetIndex,
    matches,
  });

  return updatedState;
};
