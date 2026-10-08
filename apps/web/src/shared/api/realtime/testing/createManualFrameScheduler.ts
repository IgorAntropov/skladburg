import type { IFrameScheduler } from '../realtimeTypes';

export interface ManualFrameSchedulerValue {
  cancelledCount: () => number;
  flushFrame: () => void;
  isPending: () => boolean;
  scheduleCount: () => number;
  scheduler: IFrameScheduler;
}

export const createManualFrameScheduler = (): ManualFrameSchedulerValue => {
  let pending: (() => void) | undefined;
  let scheduled = 0;
  let cancelled = 0;

  return {
    cancelledCount: () => cancelled,
    flushFrame: () => {
      const flush = pending;
      pending = undefined;
      flush?.();
    },
    isPending: () => pending !== undefined,
    scheduleCount: () => scheduled,
    scheduler: {
      schedule: (flush) => {
        scheduled += 1;
        pending = flush;

        return () => {
          if (pending === flush) {
            pending = undefined;
            cancelled += 1;
          }
        };
      },
    },
  };
};
