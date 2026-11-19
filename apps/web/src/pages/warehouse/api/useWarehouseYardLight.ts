import { useQuery } from '@tanstack/react-query';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useApiClient } from '@/shared/api';
import {
  createWorldClockQueryOptions,
  projectWorldTime,
} from '@/widgets/top-bar';

import {
  readWarehouseYardLightDelay,
  readWarehouseYardLightTime,
} from '../model/warehouseYardLightTime';

const CLOCK_RETRY_MS = 5_000;

export const useWarehouseYardLight = (timeZone: string, isEnabled: boolean): boolean => {
  const client = useApiClient();
  const { data: reading, refetch } = useQuery({
    ...createWorldClockQueryOptions(client),
    enabled: isEnabled,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  const [openedAtMs] = useState(() => performance.now());
  const initialOrConfirmedTimeMs = reading === undefined ? undefined : projectWorldTime(reading.snapshot, reading.receivedAtMs, openedAtMs);
  const light = useMemo(
    () => initialOrConfirmedTimeMs === undefined ? undefined : readWarehouseYardLightTime(initialOrConfirmedTimeMs, timeZone),
    [initialOrConfirmedTimeMs, timeZone],
  );
  const nextBoundaryMs = light?.nextBoundaryMs;

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let isActive = true;
    let isRefreshing = false;

    const schedule = (): void => {
      if (document.hidden || reading === undefined || nextBoundaryMs === undefined) {
        return;
      }

      const { receivedAtMs, snapshot } = reading;
      const projectedTimeMs = projectWorldTime(snapshot, receivedAtMs, performance.now());
      const delay = readWarehouseYardLightDelay(nextBoundaryMs, projectedTimeMs, snapshot.timeScale);
      if (delay !== undefined) {
        timer = setTimeout(refresh, delay);
      }
    };

    const refresh = (): void => {
      if (document.hidden || isRefreshing) {
        return;
      }

      isRefreshing = true;
      void refetch({ cancelRefetch: false }).then((result) => {
        isRefreshing = false;
        if (!isActive || document.hidden) {
          return;
        }
        if (result.isError && reading?.snapshot.timeScale !== 0) {
          timer = setTimeout(refresh, CLOCK_RETRY_MS);
        }
        else if (result.data === reading) {
          schedule();
        }
      });
    };

    const handleVisibility = (): void => {
      clearTimeout(timer);
      refresh();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    schedule();

    return (): void => {
      isActive = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isEnabled, nextBoundaryMs, reading, refetch]);

  return light?.isNight ?? false;
};
