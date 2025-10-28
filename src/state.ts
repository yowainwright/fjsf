import type { PackageScript } from './types.ts';
import type { FuzzyMatch } from './fuzzy.ts';

export interface State {
  query: string;
  selectedIndex: number;
  matches: FuzzyMatch<PackageScript>[];
  scripts: PackageScript[];
}

export const createInitialState = (scripts: PackageScript[]): State => ({
  query: '',
  selectedIndex: 0,
  matches: scripts.map((item) => ({ item, score: 0, matches: [] })),
  scripts,
});

export const updateSelection = (state: State, delta: number): State => {
  const maxIndex = state.matches.length - 1;
  const newIndex = Math.max(0, Math.min(maxIndex, state.selectedIndex + delta));
  return { ...state, selectedIndex: newIndex };
};

export const getSelectedScript = (state: State): PackageScript | null =>
  state.matches[state.selectedIndex]?.item ?? null;
