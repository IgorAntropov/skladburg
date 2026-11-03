import {
  describe,
  expect,
  it,
} from 'vitest';

import { splitHighlightedText } from './splitHighlightedText';

describe('splitHighlightedText', () => {
  it('returns the whole text as one plain segment without matches', () => {
    expect(splitHighlightedText('Тёплый угол', [])).toEqual([{ isMatch: false, start: 0, text: 'Тёплый угол' }]);
  });

  it('cuts the matches out of the text in order', () => {
    expect(splitHighlightedText('Яблоки Голден', [{ end: 6, start: 0 }, { end: 13, start: 7 }])).toEqual([
      { isMatch: true, start: 0, text: 'Яблоки' },
      { isMatch: false, start: 6, text: ' ' },
      { isMatch: true, start: 7, text: 'Голден' },
    ]);
  });

  it('keeps the text around a match in the middle', () => {
    expect(splitHighlightedText('Тёплый угол', [{ end: 4, start: 1 }])).toEqual([
      { isMatch: false, start: 0, text: 'Т' },
      { isMatch: true, start: 1, text: 'ёпл' },
      { isMatch: false, start: 4, text: 'ый угол' },
    ]);
  });

  it('skips empty and overlapping ranges and clamps a range that runs past the text', () => {
    expect(splitHighlightedText('Рис', [{ end: 2, start: 2 }, { end: 2, start: 0 }, { end: 1, start: 1 }, { end: 9, start: 1 }])).toEqual([
      { isMatch: true, start: 0, text: 'Ри' },
      { isMatch: true, start: 2, text: 'с' },
    ]);
  });
});
