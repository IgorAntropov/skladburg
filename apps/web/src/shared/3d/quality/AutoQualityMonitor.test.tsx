import {
  act,
  cleanup,
  render,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AutoQualityMonitor } from './AutoQualityMonitor';

const frameLoop = vi.hoisted(() => ({
  callbacks: new Set<(timestampMs: number) => void>(),
}));

vi.mock('@react-three/fiber', () => ({
  addAfterEffect: (callback: (timestampMs: number) => void): (() => void) => {
    frameLoop.callbacks.add(callback);

    return () => {
      frameLoop.callbacks.delete(callback);
    };
  },
}));

const FRAMES_FOR_TWO_WINDOWS = 62;
const IDLE_GAP_MS = 100;

const drawFrames = (count: number, intervalMs: number): void => {
  for (let index = 0; index < count; index += 1) {
    vi.advanceTimersByTime(intervalMs);

    for (const callback of frameLoop.callbacks) {
      callback(performance.now());
    }
  }
};

describe('AutoQualityMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('changes the level only after the gesture has stopped', () => {
    const onLevelChange = vi.fn();

    render(<AutoQualityMonitor ceiling="high" changeCount={0} level="high" onLevelChange={onLevelChange} />);

    act(() => {
      drawFrames(FRAMES_FOR_TWO_WINDOWS, 33);
    });

    expect(onLevelChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(IDLE_GAP_MS * 2);
    });

    expect(onLevelChange).toHaveBeenCalledTimes(1);
    expect(onLevelChange).toHaveBeenCalledWith('medium');
  });

  it('does not change the level on a smooth gesture', () => {
    const onLevelChange = vi.fn();

    render(<AutoQualityMonitor ceiling="high" changeCount={0} level="high" onLevelChange={onLevelChange} />);

    act(() => {
      drawFrames(FRAMES_FOR_TWO_WINDOWS, 16.7);
      vi.advanceTimersByTime(IDLE_GAP_MS * 2);
    });

    expect(onLevelChange).not.toHaveBeenCalled();
  });

  it('stops listening to frames and drops the idle timer on unmount', () => {
    const onLevelChange = vi.fn();
    const { unmount } = render(
      <AutoQualityMonitor ceiling="high" changeCount={0} level="high" onLevelChange={onLevelChange} />,
    );

    act(() => {
      drawFrames(FRAMES_FOR_TWO_WINDOWS, 33);
    });

    unmount();

    expect(frameLoop.callbacks.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(IDLE_GAP_MS * 2);
    });

    expect(onLevelChange).not.toHaveBeenCalled();
  });
});
