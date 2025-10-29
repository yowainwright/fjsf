import type { PackageScript } from "./types.ts";
import type { FuzzyMatch } from "./fuzzy.ts";

export interface State {
  query: string;
  selectedIndex: number;
  matches: FuzzyMatch<PackageScript>[];
  scripts: PackageScript[];
}

export const createInitialState = (scripts: PackageScript[]): State => {
  const emptyQuery = "";
  const startIndex = 0;

  const mapper = (item: PackageScript): FuzzyMatch<PackageScript> => {
    const match = Object.assign(
      {},
      {
        item,
        score: 0,
        matches: [] as number[],
      },
    );
    return match;
  };
  const initialMatches = scripts.map(mapper);

  const state = Object.assign(
    {},
    {
      query: emptyQuery,
      selectedIndex: startIndex,
      matches: initialMatches,
      scripts,
    },
  );

  return state;
};

export const updateSelection = (state: State, delta: number): State => {
  const matchesLength = state.matches.length;
  const maxIndex = matchesLength - 1;
  const currentIndex = state.selectedIndex;
  const proposedIndex = currentIndex + delta;

  const clampedMin = Math.max(0, proposedIndex);
  const clampedMax = Math.min(maxIndex, clampedMin);
  const newIndex = clampedMax;

  const updatedState = Object.assign({}, state, { selectedIndex: newIndex });
  return updatedState;
};

export const getSelectedScript = (state: State): PackageScript | null => {
  const selectedIndex = state.selectedIndex;
  const selectedMatch = state.matches[selectedIndex];
  const matchExists = selectedMatch !== undefined;

  if (matchExists) {
    return selectedMatch.item;
  }

  return null;
};
