import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { BlockedHandlerValue } from './locationTypes';
import type {
  FakeTraversalModeValue,
  IFakeBrowserWindow,
} from './testing/createFakeBrowserWindow';

import { createHashLocation } from './createHashLocation';
import { createFakeBrowserWindow } from './testing/createFakeBrowserWindow';

type BlockedMock = ReturnType<typeof vi.fn<BlockedHandlerValue>>;

interface SetupValue {
  asked: BlockedMock;
  browser: IFakeBrowserWindow;
  listener: ReturnType<typeof vi.fn<() => void>>;
  location: ReturnType<typeof createHashLocation>;
}

const MODES: readonly FakeTraversalModeValue[] = ['sum', 'drop'];

const releases: (() => void)[] = [];

const setup = (mode: FakeTraversalModeValue, paths: readonly string[]): SetupValue => {
  const browser = createFakeBrowserWindow(mode);
  const location = createHashLocation(browser.window);
  const listener = vi.fn<() => void>();
  const asked = vi.fn<BlockedHandlerValue>();

  releases.push(location.subscribe(listener));

  for (const path of paths) {
    location.navigate(path);
  }

  return { asked, browser, listener, location };
};

const startBlocking = ({ asked, location }: SetupValue): void => {
  releases.push(location.block(asked));
};

const getProceed = (asked: BlockedMock, callIndex = 0): (() => void) => {
  const proceed = asked.mock.calls[callIndex]?.[0];

  if (proceed === undefined) {
    throw new Error('The blocker was not asked');
  }

  return proceed;
};

describe.each(MODES)('createHashLocation traversal with a browser that %s queued steps', (mode) => {
  afterEach(() => {
    for (const release of releases.splice(0)) {
      release();
    }
  });

  it('follows back and forward for free when nothing blocks and notifies once for each step', () => {
    const { browser, listener, location } = setup(mode, ['/a', '/b', '/c']);
    listener.mockClear();

    browser.back();
    browser.settle();

    expect(location.read().path).toBe('/b');
    expect(listener).toHaveBeenCalledTimes(1);

    browser.forward();
    browser.settle();

    expect(location.read().path).toBe('/c');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(browser.goCalls).toEqual([]);
  });

  it('rolls one step back once with entries on both sides and asks once', () => {
    const state = setup(mode, ['/a', '/b', '/c']);
    const { asked, browser, listener, location } = state;
    browser.back();
    browser.settle();
    startBlocking(state);
    listener.mockClear();

    browser.back();
    browser.settle();

    expect(browser.goCalls).toEqual([1]);
    expect(browser.hash).toBe('#/b');
    expect(browser.index).toBe(2);
    expect(browser.isUnloaded).toBe(false);
    expect(location.read().path).toBe('/b');
    expect(listener).not.toHaveBeenCalled();
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('shows the old address while the roll back is on its way', () => {
    const state = setup(mode, ['/a', '/b', '/c']);
    const { asked, browser, location } = state;
    const pathsWhenAsked: string[] = [];
    asked.mockImplementation(() => {
      pathsWhenAsked.push(location.read().path);
    });
    startBlocking(state);

    browser.back();
    browser.step();
    browser.step();

    expect(asked).toHaveBeenCalledTimes(1);
    expect(pathsWhenAsked).toEqual(['/c']);
    expect(location.read().path).toBe('/c');
    expect(browser.hash).toBe('#/b');
  });

  it('rolls one step forward once and goes forward on proceed', () => {
    const state = setup(mode, ['/a', '/b', '/c']);
    const { asked, browser, listener, location } = state;
    browser.back();
    browser.settle();
    startBlocking(state);
    listener.mockClear();

    browser.forward();
    browser.settle();

    expect(browser.goCalls).toEqual([-1]);
    expect(browser.hash).toBe('#/b');
    expect(asked).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();

    getProceed(asked)();
    browser.settle();

    expect(browser.hash).toBe('#/c');
    expect(location.read().path).toBe('/c');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(browser.isUnloaded).toBe(false);
  });

  it('goes back on proceed after back, with the entry ahead kept', () => {
    const state = setup(mode, ['/a', '/b', '/c']);
    const { asked, browser, location } = state;
    startBlocking(state);

    browser.back();
    browser.settle();
    getProceed(asked)();
    browser.settle();

    expect(browser.hash).toBe('#/b');
    expect(location.read().path).toBe('/b');
    expect(browser.entries).toEqual(['', '#/a', '#/b', '#/c']);
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it('survives a long history without leaving the page and goes where the user went on proceed', () => {
    const state = setup(mode, ['/p1', '/p2', '/p3', '/p4', '/p5', '/p6']);
    const { asked, browser, location } = state;
    browser.back();
    browser.back();
    browser.back();
    browser.settle();
    startBlocking(state);

    expect(location.read().path).toBe('/p3');

    browser.back();
    browser.settle();

    expect(browser.goCalls).toEqual([1]);
    expect(browser.isUnloaded).toBe(false);
    expect(browser.hash).toBe('#/p3');
    expect(asked).toHaveBeenCalledTimes(1);

    getProceed(asked)();
    browser.settle();

    expect(browser.hash).toBe('#/p2');
    expect(location.read().path).toBe('/p2');
  });

  it('asks again about the next step after the user stayed', () => {
    const state = setup(mode, ['/a', '/b', '/c']);
    const { asked, browser } = state;
    startBlocking(state);

    browser.back();
    browser.settle();
    browser.back();
    browser.settle();

    expect(asked).toHaveBeenCalledTimes(2);
    expect(browser.goCalls).toEqual([1, 1]);
    expect(browser.hash).toBe('#/c');
  });

  it('treats two quick steps back as one step of two entries', () => {
    const state = setup(mode, ['/a', '/b', '/c']);
    const { asked, browser, location } = state;
    startBlocking(state);

    browser.back();
    browser.back();
    browser.settle();

    expect(asked).toHaveBeenCalledTimes(1);
    expect(browser.goCalls).toEqual([2]);
    expect(browser.hash).toBe('#/c');
    expect(location.read().path).toBe('/c');

    getProceed(asked)();
    browser.settle();

    expect(browser.hash).toBe('#/a');
  });

  it('lets a step through when only the query differs', () => {
    const state = setup(mode, ['/network?as=supplier-1', '/network?as=customer-1']);
    const { asked, browser, listener, location } = state;
    startBlocking(state);
    listener.mockClear();

    browser.back();
    browser.settle();

    expect(location.read().searchParams.get('as')).toBe('supplier-1');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(asked).not.toHaveBeenCalled();
    expect(browser.goCalls).toEqual([]);
  });

  it('rolls a typed address back by one step without a copy of the entry and opens it on proceed', () => {
    const state = setup(mode, ['/a', '/b']);
    const { asked, browser, listener, location } = state;
    startBlocking(state);
    listener.mockClear();

    browser.typeHash('#/typed');
    browser.settle();

    expect(browser.goCalls).toEqual([-1]);
    expect(browser.entries).toEqual(['', '#/a', '#/b', '#/typed']);
    expect(browser.hash).toBe('#/b');
    expect(location.read().path).toBe('/b');
    expect(asked).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();

    getProceed(asked)();
    browser.settle();

    expect(browser.hash).toBe('#/typed');
    expect(browser.entries).toEqual(['', '#/a', '#/b', '#/typed']);
    expect(browser.window.history.state).toEqual({ entryIndex: 3 });
    expect(location.read().path).toBe('/typed');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps asking and rolling back one step at a time after a typed address was refused', () => {
    const state = setup(mode, ['/a', '/b']);
    const { asked, browser } = state;
    startBlocking(state);

    browser.typeHash('#/typed');
    browser.settle();
    browser.back();
    browser.settle();

    expect(asked).toHaveBeenCalledTimes(2);
    expect(browser.hash).toBe('#/b');
    expect(browser.goCalls).toEqual([-1, 1]);
  });

  it('takes the next steps for free after the blocker is removed in the middle of a roll back', () => {
    const state = setup(mode, ['/a', '/b', '/c']);
    const { browser, listener, location } = state;
    const unblock = location.block(state.asked);

    browser.back();
    browser.step();
    browser.step();
    unblock();
    browser.settle();
    listener.mockClear();
    browser.back();
    browser.settle();

    expect(location.read().path).toBe('/b');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
