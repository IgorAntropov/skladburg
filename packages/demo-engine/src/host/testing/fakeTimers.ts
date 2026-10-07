import type { ITimerSource } from '../hostTypes';

export interface FakeTimersValue extends ITimerSource {
  activeCount: () => number;
  advance: (deltaMs: number) => void;
}

interface FakeTimerValue {
  callback: () => void;
  dueMs: number;
  id: number;
  intervalMs: number | undefined;
}

export const createFakeTimers = (): FakeTimersValue => {
  const timers = new Map<number, FakeTimerValue>();
  let nowMs = 0;
  let idCounter = 0;

  const schedule = (callback: () => void, delayMs: number, intervalMs: number | undefined): (() => void) => {
    idCounter += 1;
    const id = idCounter;
    timers.set(id, { callback, dueMs: nowMs + delayMs, id, intervalMs });

    return () => {
      timers.delete(id);
    };
  };

  const findNextDue = (limitMs: number): FakeTimerValue | undefined =>
    [...timers.values()]
      .filter(timer => timer.dueMs <= limitMs)
      .sort((current, next) => current.dueMs - next.dueMs || current.id - next.id)[0];

  const advance = (deltaMs: number): void => {
    const limitMs = nowMs + deltaMs;
    let timer = findNextDue(limitMs);

    while (timer !== undefined) {
      nowMs = timer.dueMs;

      if (timer.intervalMs === undefined) {
        timers.delete(timer.id);
      }
      else {
        timer.dueMs += timer.intervalMs;
      }

      timer.callback();
      timer = findNextDue(limitMs);
    }

    nowMs = limitMs;
  };

  return {
    activeCount: () => timers.size,
    advance,
    setInterval: (callback, intervalMs) => schedule(callback, intervalMs, intervalMs),
    setTimeout: (callback, delayMs) => schedule(callback, delayMs, undefined),
  };
};
