import type { IFrameScheduler } from './realtimeTypes';

const DEFAULT_FALLBACK_DELAY_MS = 1000;

export const createBrowserFrameScheduler = (fallbackDelayMs: number = DEFAULT_FALLBACK_DELAY_MS): IFrameScheduler => ({
  schedule: (flush) => {
    let isSettled = false;
    let frameHandle: number | undefined;

    const handleTick = (): void => {
      if (isSettled) {
        return;
      }

      settle();
      flush();
    };

    const timerHandle = setTimeout(handleTick, fallbackDelayMs);

    function settle(): void {
      isSettled = true;
      clearTimeout(timerHandle);

      if (frameHandle !== undefined) {
        globalThis.cancelAnimationFrame(frameHandle);
      }
    }

    const handleCancel = (): void => {
      if (!isSettled) {
        settle();
      }
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      frameHandle = globalThis.requestAnimationFrame(handleTick);
    }

    return handleCancel;
  },
});
