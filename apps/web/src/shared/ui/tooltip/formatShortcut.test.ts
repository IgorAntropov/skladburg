import {
  describe,
  expect,
  it,
} from 'vitest';

import { formatShortcut } from './formatShortcut';

describe('formatShortcut', () => {
  it.each([
    ['Q', ['Q']],
    ['Home', ['Home']],
    ['Plus', ['+']],
    ['-', ['−']],
  ])('turns the single key %s into its label', (shortcut, expected) => {
    expect(formatShortcut(shortcut)).toEqual(expected);
  });

  it('splits a combination into keys in the order they are pressed', () => {
    expect(formatShortcut('Control+Plus')).toEqual(['Ctrl', '+']);
    expect(formatShortcut('Control+Shift+Q')).toEqual(['Ctrl', 'Shift', 'Q']);
  });

  it('ignores empty parts left by stray separators', () => {
    expect(formatShortcut('Control+')).toEqual(['Ctrl']);
    expect(formatShortcut('+Q')).toEqual(['Q']);
  });

  it('returns no keys for an empty shortcut', () => {
    expect(formatShortcut('')).toEqual([]);
  });

  it('keeps keys that only share a name with object members as they are', () => {
    expect(formatShortcut('constructor')).toEqual(['constructor']);
    expect(formatShortcut('toString')).toEqual(['toString']);
  });
});
