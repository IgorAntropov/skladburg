import {
  useEffect,
  useState,
} from 'react';

import type { WorldClockReadingValue } from './worldClockTypes';

import { nextTickDelayMs } from './nextTickDelayMs';
import { projectWorldTime } from './projectWorldTime';
import { floorToWorldMinute } from './worldMinute';

export const useWorldClockMinute = (reading: undefined | WorldClockReadingValue): number | undefined => {
  const [minuteMs, setMinuteMs] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (reading === undefined) {
      return undefined;
    }

    const { receivedAtMs, snapshot } = reading;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const clearTimer = (): void => {
      clearTimeout(timerId);
      timerId = undefined;
    };

    const syncWithClock = (): void => {
      clearTimer();

      const worldTimeMs = projectWorldTime(snapshot, receivedAtMs, performance.now());
      setMinuteMs(floorToWorldMinute(worldTimeMs));

      if (document.visibilityState === 'hidden') {
        return;
      }

      const delayMs = nextTickDelayMs(worldTimeMs, snapshot.timeScale);

      if (delayMs !== undefined) {
        timerId = setTimeout(syncWithClock, delayMs);
      }
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        clearTimer();

        return;
      }

      syncWithClock();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    syncWithClock();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimer();
    };
  }, [reading]);

  return reading === undefined ? undefined : minuteMs;
};
