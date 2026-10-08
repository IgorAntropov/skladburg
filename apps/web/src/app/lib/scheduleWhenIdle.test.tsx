import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { scheduleWhenIdle } from './scheduleWhenIdle';

describe('scheduleWhenIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('with requestIdleCallback', () => {
    it('hands the task to the idle callback and does not run it by itself', () => {
      const requestIdleCallback = vi.fn(() => 7);
      vi.stubGlobal('requestIdleCallback', requestIdleCallback);
      vi.stubGlobal('cancelIdleCallback', vi.fn());
      const task = vi.fn();

      scheduleWhenIdle(task);

      expect(requestIdleCallback).toHaveBeenCalledExactlyOnceWith(task);
      expect(task).not.toHaveBeenCalled();
    });

    it('cancels the idle callback by its handle', () => {
      const cancelIdleCallback = vi.fn();
      vi.stubGlobal('requestIdleCallback', vi.fn(() => 7));
      vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

      scheduleWhenIdle(vi.fn())();

      expect(cancelIdleCallback).toHaveBeenCalledExactlyOnceWith(7);
    });
  });

  describe('without requestIdleCallback', () => {
    beforeEach(() => {
      vi.stubGlobal('requestIdleCallback', undefined);
    });

    it('runs the task once after the fallback delay', () => {
      const task = vi.fn();

      scheduleWhenIdle(task);

      expect(task).not.toHaveBeenCalled();

      vi.runAllTimers();

      expect(task).toHaveBeenCalledOnce();
    });

    it('does not run a cancelled task', () => {
      const task = vi.fn();

      scheduleWhenIdle(task)();
      vi.runAllTimers();

      expect(task).not.toHaveBeenCalled();
    });
  });
});
