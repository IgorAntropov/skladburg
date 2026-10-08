const LONG_TASK_ENTRY_TYPE = 'longtask';
const LONG_TASK_THRESHOLD_MS = 50;

const stopNothing = (): void => undefined;

const isLongTaskSupported = (): boolean => typeof PerformanceObserver !== 'undefined'
  && PerformanceObserver.supportedEntryTypes.includes(LONG_TASK_ENTRY_TYPE);

export const observeLongTasks = (): (() => void) => {
  if (!isLongTaskSupported()) {
    return stopNothing;
  }

  let isStopped = false;

  const observer = new PerformanceObserver((list) => {
    for (const { duration, startTime } of list.getEntries()) {
      if (duration > LONG_TASK_THRESHOLD_MS) {
        console.warn('> observeLongTasks -> entry:', { duration, startTime });
      }
    }
  });

  observer.observe({ buffered: true, type: LONG_TASK_ENTRY_TYPE });

  return (): void => {
    if (isStopped) {
      return;
    }

    isStopped = true;
    observer.disconnect();
  };
};
