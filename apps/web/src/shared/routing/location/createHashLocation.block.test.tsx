import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  BlockedHandlerValue,
  ILocationSource,
} from './locationTypes';

import { createHashLocation } from './createHashLocation';

type BlockedMock = ReturnType<typeof vi.fn<BlockedHandlerValue>>;

type ListenerMock = ReturnType<typeof vi.fn<() => void>>;

const createBlockedMock = (): BlockedMock => vi.fn<BlockedHandlerValue>();

const getProceed = (blocked: BlockedMock, callIndex = 0): (() => void) => {
  const proceed = blocked.mock.calls[callIndex]?.[0];

  if (proceed === undefined) {
    throw new Error('The blocker was not called');
  }

  return proceed;
};

const waitForHash = (hash: string): Promise<void> => vi.waitFor(() => {
  expect(window.location.hash).toBe(hash);
});

const releases: (() => void)[] = [];

const subscribeTo = (location: ILocationSource, listener: ListenerMock): void => {
  releases.push(location.subscribe(listener));
};

const blockWith = (
  location: ILocationSource,
  blocked: BlockedMock,
  shouldBlock?: (nextPath: string) => boolean,
): (() => void) => {
  const unblock = location.block(blocked, shouldBlock);

  releases.push(unblock);

  return unblock;
};

const createBlockedLocation = (): { blocked: BlockedMock; listener: ListenerMock; location: ILocationSource } => {
  const location = createHashLocation(window);
  const blocked = createBlockedMock();
  const listener = vi.fn<() => void>();
  subscribeTo(location, listener);
  blockWith(location, blocked);

  return { blocked, listener, location };
};

describe('createHashLocation block', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    for (const release of releases.splice(0)) {
      release();
    }

    vi.restoreAllMocks();
  });

  describe('navigate', () => {
    it('keeps the address and stays silent while a blocker stands', () => {
      const { blocked, listener, location } = createBlockedLocation();
      const lengthBefore = window.history.length;

      location.navigate('/deals');

      expect(location.read().path).toBe('/');
      expect(window.location.hash).toBe('');
      expect(window.history.length).toBe(lengthBefore);
      expect(listener).not.toHaveBeenCalled();
      expect(blocked).toHaveBeenCalledTimes(1);
    });

    it('performs the original navigation on proceed even while the blocker stands', () => {
      const { blocked, listener, location } = createBlockedLocation();

      location.navigate('/deals', { isFocusRequested: true });
      getProceed(blocked)();

      expect(location.read().path).toBe('/deals');
      expect(location.read().focusRequest).toBe(1);
      expect(window.location.hash).toBe('#/deals');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(blocked).toHaveBeenCalledTimes(1);
    });

    it('replaces the entry on proceed when the original navigation was a replace', () => {
      const { blocked, location } = createBlockedLocation();
      const lengthBefore = window.history.length;

      location.navigate('/deals', { isReplace: true });
      getProceed(blocked)();

      expect(window.history.length).toBe(lengthBefore);
      expect(window.location.hash).toBe('#/deals');
    });

    it('navigates freely after the blocker is removed', () => {
      const location = createHashLocation(window);
      const blocked = createBlockedMock();
      const unblock = blockWith(location, blocked);

      unblock();
      location.navigate('/deals');

      expect(location.read().path).toBe('/deals');
      expect(blocked).not.toHaveBeenCalled();
    });

    it('survives a repeated unblock without dropping the other blocker', () => {
      const location = createHashLocation(window);
      const first = createBlockedMock();
      const second = createBlockedMock();
      const unblockFirst = blockWith(location, first);
      blockWith(location, second);

      unblockFirst();
      unblockFirst();
      location.navigate('/deals');

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('lets a change of the query only pass', () => {
      window.history.replaceState(null, '', '/#/network?as=supplier-1');
      const { blocked, listener, location } = createBlockedLocation();

      location.navigate('/network?as=customer-1');

      expect(location.read().searchParams.get('as')).toBe('customer-1');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(blocked).not.toHaveBeenCalled();
    });

    it('lets a navigation to the same address pass with a focus request', () => {
      window.history.replaceState(null, '', '/#/network');
      const { blocked, listener, location } = createBlockedLocation();

      location.navigate('/network', { isFocusRequested: true });

      expect(location.read().focusRequest).toBe(1);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(blocked).not.toHaveBeenCalled();
    });

    it('treats an empty hash and the root path as the same address', () => {
      const { blocked, location } = createBlockedLocation();

      location.navigate('/?as=supplier-1');

      expect(blocked).not.toHaveBeenCalled();
      expect(location.read().searchParams.get('as')).toBe('supplier-1');
    });

    it('puts the question to the blocker that was put last and to the earlier one after the last is removed', () => {
      const location = createHashLocation(window);
      const first = createBlockedMock();
      const second = createBlockedMock();
      blockWith(location, first);
      const unblockSecond = blockWith(location, second);

      location.navigate('/deals');

      expect(first).toHaveBeenLastCalledWith(undefined);
      expect(second.mock.calls[0]?.[0]).toBeTypeOf('function');

      unblockSecond();
      location.navigate('/catalog');

      expect(first.mock.calls[1]?.[0]).toBeTypeOf('function');
    });
  });

  describe('entry numbers', () => {
    it('writes the number zero into the first entry that has no state', () => {
      const location = createHashLocation(window);
      subscribeTo(location, vi.fn<() => void>());

      expect(window.history.state).toEqual({ entryIndex: 0 });
    });

    it('keeps the number of an entry that already has one', () => {
      window.history.replaceState({ entryIndex: 7 }, '', '/#/network');
      const location = createHashLocation(window);
      subscribeTo(location, vi.fn<() => void>());

      location.navigate('/deals');

      expect(window.history.state).toEqual({ entryIndex: 8 });
    });

    it('numbers pushed entries one by one and keeps the number on a replace', () => {
      const location = createHashLocation(window);

      location.navigate('/network');
      location.navigate('/deals');

      expect(window.history.state).toEqual({ entryIndex: 2 });

      location.navigate('/catalog', { isReplace: true });

      expect(window.history.state).toEqual({ entryIndex: 2 });
    });

    it('numbers an entry that appeared from a hand-made change', async () => {
      const location = createHashLocation(window);
      const listener = vi.fn<() => void>();
      subscribeTo(location, listener);

      window.location.hash = '#/warehouse';
      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      });

      expect(window.history.state).toEqual({ entryIndex: 1 });
    });
  });

  describe('back and forward', () => {
    const createStackedLocation = (): { listener: ListenerMock; location: ILocationSource } => {
      const location = createHashLocation(window);
      const listener = vi.fn<() => void>();
      location.navigate('/network');
      location.navigate('/deals');
      subscribeTo(location, listener);

      return { listener, location };
    };

    it('returns the address on back, shows the old address meanwhile and asks once', async () => {
      const { listener, location } = createStackedLocation();
      const blocked = createBlockedMock();
      const pathsWhenAsked: string[] = [];
      blocked.mockImplementation(() => {
        pathsWhenAsked.push(location.read().path);
      });
      blockWith(location, blocked);

      window.history.back();
      await vi.waitFor(() => {
        expect(blocked).toHaveBeenCalledTimes(1);
      });
      await waitForHash('#/deals');

      expect(pathsWhenAsked).toEqual(['/deals']);
      expect(location.read().path).toBe('/deals');
      expect(listener).not.toHaveBeenCalled();
      expect(blocked).toHaveBeenCalledTimes(1);
    });

    it('goes back for real on proceed', async () => {
      const { listener, location } = createStackedLocation();
      const blocked = createBlockedMock();
      blockWith(location, blocked);
      window.history.back();
      await vi.waitFor(() => {
        expect(blocked).toHaveBeenCalledTimes(1);
      });
      await waitForHash('#/deals');

      getProceed(blocked)();
      await waitForHash('#/network');
      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      });

      expect(location.read().path).toBe('/network');
      expect(blocked).toHaveBeenCalledTimes(1);

      location.navigate('/catalog');

      expect(blocked).toHaveBeenCalledTimes(2);
    });

    it('returns the address on forward and goes forward on proceed', async () => {
      const { listener, location } = createStackedLocation();
      window.history.back();
      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      });
      const blocked = createBlockedMock();
      blockWith(location, blocked);

      window.history.forward();
      await vi.waitFor(() => {
        expect(blocked).toHaveBeenCalledTimes(1);
      });
      await waitForHash('#/network');

      expect(location.read().path).toBe('/network');
      expect(listener).toHaveBeenCalledTimes(1);

      getProceed(blocked)();
      await waitForHash('#/deals');
      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledTimes(2);
      });

      expect(location.read().path).toBe('/deals');
    });

    it('settles on the old address after two quick steps back and asks once', async () => {
      const location = createHashLocation(window);
      const listener = vi.fn<() => void>();
      location.navigate('/network');
      location.navigate('/deals');
      location.navigate('/catalog');
      subscribeTo(location, listener);
      const blocked = createBlockedMock();
      blockWith(location, blocked);

      window.history.back();
      window.history.back();
      await vi.waitFor(() => {
        expect(blocked).toHaveBeenCalledTimes(1);
      });
      await waitForHash('#/catalog');

      expect(location.read().path).toBe('/catalog');
      expect(listener).not.toHaveBeenCalled();
      expect(blocked).toHaveBeenCalledTimes(1);
    });

    it('catches back with a blocker alone, without a subscriber', async () => {
      const location = createHashLocation(window);
      location.navigate('/network');
      location.navigate('/deals');
      const blocked = createBlockedMock();
      const unblock = blockWith(location, blocked);

      window.history.back();
      await vi.waitFor(() => {
        expect(blocked).toHaveBeenCalledTimes(1);
      });
      await waitForHash('#/deals');
      unblock();
      window.history.back();
      await waitForHash('#/network');

      expect(blocked).toHaveBeenCalledTimes(1);
    });

    it('lets back pass when only the query differs', async () => {
      const location = createHashLocation(window);
      const listener = vi.fn<() => void>();
      location.navigate('/network?as=supplier-1');
      location.navigate('/network?as=customer-1');
      subscribeTo(location, listener);
      const blocked = createBlockedMock();
      blockWith(location, blocked);

      window.history.back();
      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      });

      expect(location.read().searchParams.get('as')).toBe('supplier-1');
      expect(blocked).not.toHaveBeenCalled();
    });

    it('lets back pass after the blocker is removed', async () => {
      const { listener, location } = createStackedLocation();
      const unblock = blockWith(location, createBlockedMock());

      unblock();
      window.history.back();
      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      });

      expect(location.read().path).toBe('/network');
    });
  });

  describe('hand-made address change', () => {
    it('returns the old address, keeps the entries and asks', async () => {
      const { blocked, listener, location } = createBlockedLocation();
      location.navigate('/deals');
      getProceed(blocked)();
      listener.mockClear();
      blocked.mockClear();
      const lengthBefore = window.history.length;

      window.location.hash = '#/warehouse';
      await vi.waitFor(() => {
        expect(blocked).toHaveBeenCalledTimes(1);
      });
      await waitForHash('#/deals');

      expect(location.read().path).toBe('/deals');
      expect(window.history.length).toBe(lengthBefore + 1);
      expect(listener).not.toHaveBeenCalled();
      expect(blocked).toHaveBeenCalledTimes(1);
    });

    it('opens the typed address on proceed and numbers its entry', async () => {
      const { blocked, listener, location } = createBlockedLocation();
      window.location.hash = '#/warehouse?as=supplier-1';
      await vi.waitFor(() => {
        expect(blocked).toHaveBeenCalledTimes(1);
      });
      await waitForHash('');
      const lengthBefore = window.history.length;

      getProceed(blocked)();
      await waitForHash('#/warehouse?as=supplier-1');
      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      });

      expect(window.history.length).toBe(lengthBefore);
      expect(window.history.state).toEqual({ entryIndex: 1 });
      expect(location.read().path).toBe('/warehouse');
      expect(blocked).toHaveBeenCalledTimes(1);
    });
  });

  describe('several blockers', () => {
    it('asks only the last one that was triggered and tells the others to drop their question', () => {
      const location = createHashLocation(window);
      const first = createBlockedMock();
      const second = createBlockedMock();
      const third = createBlockedMock();
      blockWith(location, first);
      blockWith(location, second);
      blockWith(location, third, () => false);

      location.navigate('/deals');

      expect(first).toHaveBeenCalledTimes(1);
      expect(first).toHaveBeenCalledWith(undefined);
      expect(second).toHaveBeenCalledTimes(1);
      expect(typeof second.mock.calls[0]?.[0]).toBe('function');
      expect(third).not.toHaveBeenCalled();
    });

    it('passes the next path without the query to the condition and skips a blocker that does not apply', () => {
      const location = createHashLocation(window);
      const blocked = createBlockedMock();
      const shouldBlock = vi.fn((nextPath: string) => nextPath !== '/catalog');
      blockWith(location, blocked, shouldBlock);

      location.navigate('/catalog');

      expect(shouldBlock).toHaveBeenCalledWith('/catalog');
      expect(location.read().path).toBe('/catalog');
      expect(blocked).not.toHaveBeenCalled();

      location.navigate('/deals');

      expect(location.read().path).toBe('/catalog');
      expect(blocked).toHaveBeenCalledTimes(1);
    });
  });
});
