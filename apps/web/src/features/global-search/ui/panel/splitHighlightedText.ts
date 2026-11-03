import type { MatchRangeValue } from '../../model/searchResultTypes';

export interface HighlightSegmentValue {
  isMatch: boolean;
  start: number;
  text: string;
}

export const splitHighlightedText = (text: string, matches: readonly MatchRangeValue[]): HighlightSegmentValue[] => {
  const segments: HighlightSegmentValue[] = [];
  let cursor = 0;

  for (const { end, start } of matches) {
    const safeStart = Math.max(start, cursor);
    const safeEnd = Math.min(end, text.length);

    if (safeStart >= safeEnd) {
      continue;
    }

    if (safeStart > cursor) {
      segments.push({ isMatch: false, start: cursor, text: text.slice(cursor, safeStart) });
    }

    segments.push({ isMatch: true, start: safeStart, text: text.slice(safeStart, safeEnd) });
    cursor = safeEnd;
  }

  if (cursor < text.length) {
    segments.push({ isMatch: false, start: cursor, text: text.slice(cursor) });
  }

  return segments;
};
