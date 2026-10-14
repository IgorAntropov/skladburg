import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { createContextLossWatch } from './createContextLossWatch';

const TIMEOUT_MS = 3000;

const createWatch = (): {
  onTimeout: ReturnType<typeof vi.fn>;
  setVisible: (isVisible: boolean) => void;
  watch: ReturnType<typeof createContextLossWatch>;
} => {
  const onTimeout = vi.fn();
  const page = { isVisible: true };
  const watch = createContextLossWatch({ isPageVisible: () => page.isVisible, onTimeout, timeoutMs: TIMEOUT_MS });

  return {
    onTimeout,
    setVisible: (isVisible) => {
      page.isVisible = isVisible;
      watch.visibilityChanged();
    },
    watch,
  };
};

describe('createContextLossWatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call back when the context is restored before the timeout', () => {
    const { onTimeout, watch } = createWatch();

    watch.lost();
    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    watch.restored();
    vi.advanceTimersByTime(TIMEOUT_MS * 2);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('calls back once when the context is not restored in time', () => {
    const { onTimeout, watch } = createWatch();

    watch.lost();
    vi.advanceTimersByTime(TIMEOUT_MS - 1);

    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(TIMEOUT_MS * 2);

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('does not call back after dispose', () => {
    const { onTimeout, watch } = createWatch();

    watch.lost();
    watch.dispose();
    vi.advanceTimersByTime(TIMEOUT_MS * 2);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('does not start a second timer on a repeated loss', () => {
    const { onTimeout, watch } = createWatch();

    watch.lost();
    vi.advanceTimersByTime(TIMEOUT_MS / 2);
    watch.lost();

    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(TIMEOUT_MS / 2);

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('waits again after a loss that followed a restore', () => {
    const { onTimeout, watch } = createWatch();

    watch.lost();
    watch.restored();
    watch.lost();
    vi.advanceTimersByTime(TIMEOUT_MS);

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('does not start the timer when the context is lost on a hidden page', () => {
    const { onTimeout, setVisible, watch } = createWatch();

    setVisible(false);
    watch.lost();

    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(TIMEOUT_MS * 2);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('counts the whole timeout anew once the page is shown with the context still lost', () => {
    const { onTimeout, setVisible, watch } = createWatch();

    setVisible(false);
    watch.lost();
    vi.advanceTimersByTime(TIMEOUT_MS * 2);
    setVisible(true);
    vi.advanceTimersByTime(TIMEOUT_MS - 1);

    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('drops the timer when the page is hidden during the countdown', () => {
    const { onTimeout, setVisible, watch } = createWatch();

    watch.lost();
    vi.advanceTimersByTime(TIMEOUT_MS - 1);
    setVisible(false);

    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(TIMEOUT_MS * 2);

    expect(onTimeout).not.toHaveBeenCalled();

    setVisible(true);
    vi.advanceTimersByTime(TIMEOUT_MS);

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('does not call back after the page is shown if the context was restored while hidden', () => {
    const { onTimeout, setVisible, watch } = createWatch();

    watch.lost();
    setVisible(false);
    watch.restored();
    setVisible(true);
    vi.advanceTimersByTime(TIMEOUT_MS * 2);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('ignores visibility changes while the context is fine', () => {
    const { onTimeout, setVisible } = createWatch();

    setVisible(false);
    setVisible(true);
    vi.advanceTimersByTime(TIMEOUT_MS * 2);

    expect(vi.getTimerCount()).toBe(0);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
