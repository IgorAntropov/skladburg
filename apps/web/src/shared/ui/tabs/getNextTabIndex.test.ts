import {
  describe,
  expect,
  it,
} from 'vitest';

import { getNextTabIndex } from './getNextTabIndex';

describe('getNextTabIndex', () => {
  it('moves to the next tab on ArrowRight', () => {
    expect(getNextTabIndex('ArrowRight', 0, 3)).toBe(1);
  });

  it('wraps from the last tab to the first on ArrowRight', () => {
    expect(getNextTabIndex('ArrowRight', 2, 3)).toBe(0);
  });

  it('moves to the previous tab on ArrowLeft', () => {
    expect(getNextTabIndex('ArrowLeft', 2, 3)).toBe(1);
  });

  it('wraps from the first tab to the last on ArrowLeft', () => {
    expect(getNextTabIndex('ArrowLeft', 0, 3)).toBe(2);
  });

  it('jumps to the first tab on Home', () => {
    expect(getNextTabIndex('Home', 2, 3)).toBe(0);
  });

  it('jumps to the last tab on End', () => {
    expect(getNextTabIndex('End', 0, 3)).toBe(2);
  });

  it('ignores other keys', () => {
    expect(getNextTabIndex('ArrowDown', 1, 3)).toBeUndefined();
    expect(getNextTabIndex('Enter', 1, 3)).toBeUndefined();
    expect(getNextTabIndex('a', 1, 3)).toBeUndefined();
  });

  it('stays on the only tab', () => {
    expect(getNextTabIndex('ArrowRight', 0, 1)).toBe(0);
    expect(getNextTabIndex('ArrowLeft', 0, 1)).toBe(0);
    expect(getNextTabIndex('Home', 0, 1)).toBe(0);
    expect(getNextTabIndex('End', 0, 1)).toBe(0);
  });

  it('returns nothing without tabs', () => {
    expect(getNextTabIndex('ArrowRight', 0, 0)).toBeUndefined();
  });
});
