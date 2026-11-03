import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { BlockedHandlerValue } from '../locationTypes';

import { createMemoryLocation } from './createMemoryLocation';

const getProceed = (blocked: ReturnType<typeof vi.fn<BlockedHandlerValue>>): (() => void) => {
  const proceed = blocked.mock.calls[0]?.[0];

  if (proceed === undefined) {
    throw new Error('The blocker was not called');
  }

  return proceed;
};

describe('createMemoryLocation block', () => {
  it('keeps the address and stays silent on navigate, then navigates on proceed', () => {
    const location = createMemoryLocation('/');
    const listener = vi.fn();
    const blocked = vi.fn<BlockedHandlerValue>();
    location.subscribe(listener);
    location.block(blocked);

    location.navigate('/deals');

    expect(location.read().path).toBe('/');
    expect(location.history).toEqual(['/']);
    expect(listener).not.toHaveBeenCalled();

    getProceed(blocked)();

    expect(location.read().path).toBe('/deals');
    expect(location.history).toEqual(['/', '/deals']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps the entry on back and moves on proceed', () => {
    const location = createMemoryLocation('/');
    location.navigate('/deals');
    const blocked = vi.fn<BlockedHandlerValue>();
    location.block(blocked);

    location.back();

    expect(location.currentIndex).toBe(1);

    getProceed(blocked)();

    expect(location.currentIndex).toBe(0);
  });

  it('keeps the entry on forward and moves on proceed', () => {
    const location = createMemoryLocation('/');
    location.navigate('/deals');
    location.back();
    const blocked = vi.fn<BlockedHandlerValue>();
    location.block(blocked);

    location.forward();

    expect(location.currentIndex).toBe(0);

    getProceed(blocked)();

    expect(location.currentIndex).toBe(1);
  });

  it('lets pass a change of the query only and everything after the blocker is removed', () => {
    const location = createMemoryLocation('/network');
    const blocked = vi.fn<BlockedHandlerValue>();
    const unblock = location.block(blocked);

    location.navigate('/network?as=supplier-1');

    expect(location.read().searchParams.get('as')).toBe('supplier-1');
    expect(blocked).not.toHaveBeenCalled();

    unblock();
    location.navigate('/deals');

    expect(location.read().path).toBe('/deals');
    expect(blocked).not.toHaveBeenCalled();
  });
});
