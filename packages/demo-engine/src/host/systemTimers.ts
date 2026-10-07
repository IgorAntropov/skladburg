import type { ITimerSource } from './hostTypes';

export const createSystemTimers = (): ITimerSource => ({
  setInterval: (callback, intervalMs) => {
    const timerId = setInterval(callback, intervalMs);

    return () => {
      clearInterval(timerId);
    };
  },
  setTimeout: (callback, delayMs) => {
    const timerId = setTimeout(callback, delayMs);

    return () => {
      clearTimeout(timerId);
    };
  },
});
