export interface IContextLossWatch {
  dispose: () => void;
  lost: () => void;
  restored: () => void;
  visibilityChanged: () => void;
}

interface ContextLossWatchOptionsValue {
  isPageVisible: () => boolean;
  onTimeout: () => void;
  timeoutMs: number;
}

export const CONTEXT_RESTORE_TIMEOUT_MS = 3000;

export const createContextLossWatch = ({
  isPageVisible,
  onTimeout,
  timeoutMs,
}: ContextLossWatchOptionsValue): IContextLossWatch => {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let isContextLost = false;

  const stop = (): void => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
      timerId = undefined;
    }
  };

  const start = (): void => {
    if (timerId !== undefined) {
      return;
    }

    timerId = setTimeout(() => {
      timerId = undefined;
      isContextLost = false;
      onTimeout();
    }, timeoutMs);
  };

  const lost = (): void => {
    isContextLost = true;

    if (isPageVisible()) {
      start();
    }
  };

  const restored = (): void => {
    isContextLost = false;
    stop();
  };

  const visibilityChanged = (): void => {
    if (!isContextLost) {
      return;
    }

    if (isPageVisible()) {
      start();

      return;
    }

    stop();
  };

  const dispose = (): void => {
    isContextLost = false;
    stop();
  };

  return { dispose, lost, restored, visibilityChanged };
};
