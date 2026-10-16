import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createPreparationTracker } from './createPreparationTracker.ts';

const TIMEOUT_MS = 1000;

const trackWait = (wait: Promise<void>): { isDone: () => boolean } => {
  let isDone = false;

  wait.then(() => {
    isDone = true;
  }).catch(() => undefined);

  return { isDone: () => isDone };
};

describe('createPreparationTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts every target as pending and reports a repeated target only once', () => {
    const tracker = createPreparationTracker();

    expect(tracker.begin('a')).toBe(true);
    expect(tracker.begin('a')).toBe(false);
    expect(tracker.outcomes()).toEqual(['pending']);
  });

  it('does not wait when nothing is pending', async () => {
    const tracker = createPreparationTracker();

    tracker.begin('a');
    tracker.settle('a', 'applied');

    await tracker.waitForSettled(TIMEOUT_MS);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('wakes the waiter as soon as the last pending target settles and clears its timer', async () => {
    const tracker = createPreparationTracker();

    tracker.begin('a');
    tracker.begin('b');

    const wait = trackWait(tracker.waitForSettled(TIMEOUT_MS));

    tracker.settle('a', 'applied');
    await vi.advanceTimersByTimeAsync(10);

    expect(wait.isDone()).toBe(false);

    tracker.settle('b', 'refused');
    await vi.advanceTimersByTimeAsync(0);

    expect(wait.isDone()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(tracker.outcomes()).toEqual(['applied', 'refused']);
  });

  it('gives up after the timeout and leaves the unfinished target pending', async () => {
    const tracker = createPreparationTracker();

    tracker.begin('a');

    const wait = trackWait(tracker.waitForSettled(TIMEOUT_MS));

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS - 1);

    expect(wait.isDone()).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(wait.isDone()).toBe(true);
    expect(tracker.outcomes()).toEqual(['pending']);
  });

  it('keeps the first outcome when a target settles twice', () => {
    const tracker = createPreparationTracker();

    tracker.begin('a');
    tracker.settle('a', 'refused');
    tracker.settle('a', 'applied');

    expect(tracker.outcomes()).toEqual(['refused']);
  });

  it('wakes several waiters at once', async () => {
    const tracker = createPreparationTracker();

    tracker.begin('a');

    const first = trackWait(tracker.waitForSettled(TIMEOUT_MS));
    const second = trackWait(tracker.waitForSettled(TIMEOUT_MS));

    tracker.settle('a', 'applied');
    await vi.advanceTimersByTimeAsync(0);

    expect(first.isDone()).toBe(true);
    expect(second.isDone()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
