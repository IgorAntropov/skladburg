import {
  describe,
  expect,
  it,
} from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('joins the parts with a single space in the given order', () => {
    expect(cn('flex', 'gap-2', 'p-4')).toBe('flex gap-2 p-4');
  });

  it('skips false, null, undefined and empty strings', () => {
    expect(cn('flex', false, null, undefined, '', 'p-4')).toBe('flex p-4');
  });

  it('returns an empty string when nothing is left', () => {
    expect(cn(false, null, undefined, '')).toBe('');
    expect(cn()).toBe('');
  });

  it('keeps conditional parts where they stand', () => {
    const readFlag = (flag: boolean): boolean => flag;
    const isActive = readFlag(true);
    const isDisabled = readFlag(false);

    expect(cn('base', isActive && 'active', isDisabled && 'disabled', 'tail')).toBe('base active tail');
  });
});
