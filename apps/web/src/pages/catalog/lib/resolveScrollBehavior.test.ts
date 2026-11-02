import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { resolveScrollBehavior } from './resolveScrollBehavior';

const stubMatchMedia = (isReduced: boolean): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: isReduced && query.includes('reduce') }));
};

describe('resolveScrollBehavior', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scrolls smoothly when motion is allowed', () => {
    stubMatchMedia(false);

    expect(resolveScrollBehavior()).toBe('smooth');
  });

  it('jumps at once when the user prefers reduced motion', () => {
    stubMatchMedia(true);

    expect(resolveScrollBehavior()).toBe('auto');
  });

  it('scrolls smoothly when the browser cannot report the preference', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(resolveScrollBehavior()).toBe('smooth');
  });
});
