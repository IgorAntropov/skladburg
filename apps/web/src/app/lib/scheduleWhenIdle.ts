const IDLE_FALLBACK_DELAY_MS = 200;

export const scheduleWhenIdle = (task: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(task);

    return (): void => {
      window.cancelIdleCallback(handle);
    };
  }

  const timer = window.setTimeout(task, IDLE_FALLBACK_DELAY_MS);

  return (): void => {
    window.clearTimeout(timer);
  };
};
