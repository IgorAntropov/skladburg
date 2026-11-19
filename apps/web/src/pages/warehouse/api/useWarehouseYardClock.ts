import { useQuery } from '@tanstack/react-query';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useApiClient } from '@/shared/api';
import {
  createWorldClockQueryOptions,
  projectWorldTime,
} from '@/widgets/top-bar';

import {
  isYardClockRefreshDue,
  readYardClockDelay,
} from '../model/yardDispatchClock';

export const useWarehouseYardClock = (
  boundaries: readonly number[],
  slotStarts: readonly number[],
  isEnabled: boolean,
  onTimeRefresh: () => void,
  onDataRefresh: () => void,
): number | undefined => {
  const client = useApiClient();
  const { data: reading, refetch } = useQuery({ ...createWorldClockQueryOptions(client), enabled: isEnabled });
  const [timeMs, setTimeMs] = useState<number>();
  const lastRefresh = useRef({ monotonicMs: 0, timeMs: 0 });

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let prev: number | undefined;
    let wasHidden = document.hidden;

    const sync = (): void => {
      if (document.hidden || reading === undefined) {
        return;
      }

      const monotonicMs = performance.now();
      const current = projectWorldTime(reading.snapshot, reading.receivedAtMs, monotonicMs);
      setTimeMs(current);
      const last = lastRefresh.current;
      const previousTime = prev;
      if (previousTime !== undefined && boundaries.some(boundary => previousTime < boundary && boundary <= current)) {
        lastRefresh.current = { monotonicMs, timeMs: current };
        onDataRefresh();
      }
      else if (prev !== undefined && isYardClockRefreshDue(last.timeMs, current, last.monotonicMs, monotonicMs)) {
        lastRefresh.current = { monotonicMs, timeMs: current };
        onTimeRefresh();
      }

      prev = current;
      const delay = readYardClockDelay(current, reading.snapshot.timeScale, boundaries, slotStarts);
      if (delay !== undefined) {
        timer = setTimeout(sync, delay);
      }
    };

    const handleVisibility = (): void => {
      clearTimeout(timer);
      if (document.hidden) {
        wasHidden = true;
      }
      else if (wasHidden) {
        wasHidden = false;
        void refetch({ cancelRefetch: false });
        onDataRefresh();
        sync();
      }
    };

    if (lastRefresh.current.timeMs === 0 && reading !== undefined) {
      lastRefresh.current = { monotonicMs: performance.now(), timeMs: reading.snapshot.worldTimeMs };
    }

    document.addEventListener('visibilitychange', handleVisibility);
    sync();
    return (): void => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [boundaries, isEnabled, onDataRefresh, onTimeRefresh, reading, refetch, slotStarts]);

  return isEnabled && reading !== undefined ? timeMs : undefined;
};
