import {
  describe,
  expect,
  it,
} from 'vitest';

import type { ViewportQueryListsValue } from './viewportQueryLists';

import { readViewportClass } from './readViewportClass';
import { VIEWPORT_MEDIA_QUERIES } from './viewportTypes';

const createQueryLists = (matchingQueries: readonly string[]): ViewportQueryListsValue => ({
  desktop: { matches: matchingQueries.includes(VIEWPORT_MEDIA_QUERIES.desktop) } as MediaQueryList,
  tablet: { matches: matchingQueries.includes(VIEWPORT_MEDIA_QUERIES.tablet) } as MediaQueryList,
});

describe('readViewportClass', () => {
  it('uses the standard small and extra large breakpoints of the design system', () => {
    expect(VIEWPORT_MEDIA_QUERIES).toEqual({ desktop: '(min-width: 80rem)', tablet: '(min-width: 40rem)' });
  });

  it('is a desktop when the width reaches the large breakpoint', () => {
    const queryLists = createQueryLists([VIEWPORT_MEDIA_QUERIES.desktop, VIEWPORT_MEDIA_QUERIES.tablet]);

    expect(readViewportClass(queryLists)).toBe('desktop');
  });

  it('is a tablet between the breakpoints', () => {
    expect(readViewportClass(createQueryLists([VIEWPORT_MEDIA_QUERIES.tablet]))).toBe('tablet');
  });

  it('is a phone below the small breakpoint', () => {
    expect(readViewportClass(createQueryLists([]))).toBe('phone');
  });

  it('is a desktop when the environment has no media queries', () => {
    expect(readViewportClass(undefined)).toBe('desktop');
  });
});
