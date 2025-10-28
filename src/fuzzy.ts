export interface FuzzyMatch<T> {
  item: T;
  score: number;
  matches: number[];
}

const calculateScore = (text: string, pattern: string, matches: number[]): number => {
  let score = matches.length * 100;

  const consecutiveBonus = matches.reduce((bonus, pos, idx) => {
    if (idx === 0) return bonus;
    return matches[idx - 1] === pos - 1 ? bonus + 5 : bonus;
  }, 0);

  const startBonus = matches[0] === 0 ? 10 : 0;

  const lengthPenalty = text.length - pattern.length;

  return score + consecutiveBonus + startBonus - lengthPenalty;
};

const findMatches = (text: string, pattern: string): number[] | null => {
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase();
  const matches: number[] = [];

  let textIdx = 0;
  let patternIdx = 0;

  while (textIdx < lowerText.length && patternIdx < lowerPattern.length) {
    if (lowerText[textIdx] === lowerPattern[patternIdx]) {
      matches.push(textIdx);
      patternIdx++;
    }
    textIdx++;
  }

  return patternIdx === lowerPattern.length ? matches : null;
};

const createFuzzyMatch = <T>(item: T, text: string, pattern: string): FuzzyMatch<T> | null => {
  const matches = findMatches(text, pattern);
  if (!matches) return null;

  const score = calculateScore(text, pattern, matches);
  return { item, score, matches };
};

const compareScores = <T>(a: FuzzyMatch<T>, b: FuzzyMatch<T>): number => b.score - a.score;

export const fuzzySearch = <T>(
  items: T[],
  pattern: string,
  getText: (item: T) => string
): FuzzyMatch<T>[] => {
  if (!pattern) {
    return items.map((item) => ({
      item,
      score: 0,
      matches: [],
    }));
  }

  return items
    .map((item) => createFuzzyMatch(item, getText(item), pattern))
    .filter((match): match is FuzzyMatch<T> => match !== null)
    .sort(compareScores);
};
