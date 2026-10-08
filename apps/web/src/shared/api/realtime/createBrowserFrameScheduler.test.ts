import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createBrowserFrameScheduler } from './createBrowserFrameScheduler';

interface FakeFramesValue {
  cancelAnimationFrame: ReturnType<typeof vi.fn<(handle: number) => void>>;
  requestAnimationFrame: ReturnType<typeof vi.fn<(callback: () => void) => number>>;
  runFrame: () => void;
}

const stubAnimationFrames = (): FakeFramesValue => {
  let callback: (() => void) | undefined;
  const requestAnimationFrame = vi.fn((next: () => void): number => {
    callback = next;

    return 42;
  });
  const cancelAnimationFrame = vi.fn<(handle: number) => void>();

  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);

  return {
    cancelAnimationFrame,
    requestAnimationFrame,
    runFrame: () => {
      callback?.();
    },
  };
};

describe('createBrowserFrameScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('flushes on the animation frame and cancels the fallback timer', () => {
    const frames = stubAnimationFrames();
    const flush = vi.fn();

    createBrowserFrameScheduler().schedule(flush);
    frames.runFrame();

    expect(flush).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(5000);

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('flushes on the fallback timer when the animation frame never comes and cancels the frame', () => {
    const frames = stubAnimationFrames();
    const flush = vi.fn();

    createBrowserFrameScheduler().schedule(flush);
    vi.advanceTimersByTime(999);

    expect(flush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(frames.cancelAnimationFrame).toHaveBeenCalledWith(42);

    frames.runFrame();

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('uses the given fallback delay', () => {
    stubAnimationFrames();
    const flush = vi.fn();

    createBrowserFrameScheduler(250).schedule(flush);
    vi.advanceTimersByTime(250);

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('cancels both the frame and the timer', () => {
    const frames = stubAnimationFrames();
    const flush = vi.fn();

    const cancel = createBrowserFrameScheduler().schedule(flush);
    cancel();

    expect(frames.cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(vi.getTimerCount()).toBe(0);

    frames.runFrame();
    vi.advanceTimersByTime(5000);

    expect(flush).not.toHaveBeenCalled();
  });

  it('does not touch the frame after the flush when cancelled late', () => {
    const frames = stubAnimationFrames();
    const flush = vi.fn();

    const cancel = createBrowserFrameScheduler().schedule(flush);
    frames.runFrame();
    frames.cancelAnimationFrame.mockClear();
    cancel();

    expect(frames.cancelAnimationFrame).not.toHaveBeenCalled();
  });

  it('works with the timer alone when there is no animation frame', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const flush = vi.fn();

    const scheduler = createBrowserFrameScheduler();
    scheduler.schedule(flush);
    vi.advanceTimersByTime(1000);

    expect(flush).toHaveBeenCalledTimes(1);

    const cancel = scheduler.schedule(flush);
    cancel();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('schedules independent flushes', () => {
    const frames = stubAnimationFrames();
    const first = vi.fn();
    const second = vi.fn();
    const scheduler = createBrowserFrameScheduler();

    scheduler.schedule(first)();
    scheduler.schedule(second);
    frames.runFrame();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
