import {
  describe,
  expect,
  it,
} from 'vitest';

import { hasSlot } from './hasSlot';

describe('hasSlot', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['false', false],
  ])('treats %s as an empty slot', (_name, slot) => {
    expect(hasSlot(slot)).toBe(false);
  });

  it.each([
    ['a string', 'Text'],
    ['zero', 0],
    ['an empty string', ''],
  ])('treats %s as a filled slot', (_name, slot) => {
    expect(hasSlot(slot)).toBe(true);
  });
});
