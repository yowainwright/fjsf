export interface FuzzyMatch<T> {
  item: T;
  score: number;
  matches: number[];
}

const calculateScore = (
  text: string,
  pattern: string,
  matches: number[],
): number => {
  const baseScore = matches.length * 100;

  const reducer = (bonus: number, pos: number, idx: number): number => {
    const isFirstIndex = idx === 0;
    if (isFirstIndex) return bonus;

    const previousMatch = matches[idx - 1];
    const isConsecutive = previousMatch === pos - 1;
    const consecutiveBonus = isConsecutive ? 5 : 0;
    return bonus + consecutiveBonus;
  };
  const consecutiveBonus = matches.reduce(reducer, 0);

  const firstMatch = matches[0];
  const startsAtBeginning = firstMatch === 0;
  const startBonus = startsAtBeginning ? 10 : 0;

  const lengthPenalty = text.length - pattern.length;

  const totalScore = baseScore + consecutiveBonus + startBonus - lengthPenalty;
  return totalScore;
};

const findMatches = (text: string, pattern: string): number[] | null => {
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase();
  const matches: number[] = [];

  let textIdx = 0;
  let patternIdx = 0;

  const shouldContinue = (): boolean => {
    const textNotExhausted = textIdx < lowerText.length;
    const patternNotExhausted = patternIdx < lowerPattern.length;
    return textNotExhausted && patternNotExhausted;
  };

  while (shouldContinue()) {
    const textChar = lowerText[textIdx];
    const patternChar = lowerPattern[patternIdx];
    const charsMatch = textChar === patternChar;

    if (charsMatch) {
      matches.push(textIdx);
      patternIdx = patternIdx + 1;
    }

    textIdx = textIdx + 1;
  }

  const allPatternMatched = patternIdx === lowerPattern.length;
  return allPatternMatched ? matches : null;
};

const createFuzzyMatch = <T>(
  item: T,
  text: string,
  pattern: string,
): FuzzyMatch<T> | null => {
  const matches = findMatches(text, pattern);
  const hasNoMatches = !matches;

  if (hasNoMatches) return null;

  const score = calculateScore(text, pattern, matches);
  const match = Object.assign({}, { item, score, matches });
  return match;
};

const compareScores = <T>(a: FuzzyMatch<T>, b: FuzzyMatch<T>): number =>
  b.score - a.score;

export const fuzzySearch = <T>(
  items: T[],
  pattern: string,
  getText: (item: T) => string,
): FuzzyMatch<T>[] => {
  const hasNoPattern = !pattern;

  if (hasNoPattern) {
    const mapper = (item: T): FuzzyMatch<T> => {
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
    return items.map(mapper);
  }

  const mapper = (item: T): FuzzyMatch<T> | null => {
    const text = getText(item);
    return createFuzzyMatch(item, text, pattern);
  };
  const matches = items.map(mapper);

  const filter = (match: FuzzyMatch<T> | null): match is FuzzyMatch<T> =>
    match !== null;
  const validMatches = matches.filter(filter);

  const sortedMatches = validMatches.sort(compareScores);
  return sortedMatches;
};
