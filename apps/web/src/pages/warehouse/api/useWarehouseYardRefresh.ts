import type { UseQueryResult } from '@tanstack/react-query';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

interface WarehouseYardReadStampValue {
  data: unknown;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
}

interface WarehouseYardReadValue extends WarehouseYardReadStampValue {
  fetchStatus: UseQueryResult['fetchStatus'];
  refetch: () => Promise<WarehouseYardReadStampValue>;
}

interface WarehouseYardRefreshValue {
  marks: readonly (undefined | WarehouseYardReadStampValue)[] | undefined;
  scope: string;
}

const hasAcceptedRefresh = (
  current: undefined | WarehouseYardReadValue,
  mark: undefined | WarehouseYardReadStampValue,
): boolean => {
  if (current === undefined) {
    return true;
  }

  const { data, dataUpdatedAt, errorUpdatedAt, fetchStatus } = current;
  return fetchStatus !== 'fetching' && (mark === undefined || (errorUpdatedAt >= mark.errorUpdatedAt
    && (dataUpdatedAt > mark.dataUpdatedAt || (dataUpdatedAt === mark.dataUpdatedAt && data === mark.data))));
};

export const useWarehouseYardRefresh = (
  scope: string,
  picking: undefined | WarehouseYardReadValue,
  receiving: undefined | WarehouseYardReadValue,
  trips: undefined | WarehouseYardReadValue,
): boolean => {
  const [refresh, setRefresh] = useState<WarehouseYardRefreshValue>();
  const pendingScope = useRef<string | undefined>(undefined);
  const refetchPicking = picking?.refetch;
  const refetchReceiving = receiving?.refetch;
  const refetchTrips = trips?.refetch;
  const hasReader = refetchPicking !== undefined || refetchReceiving !== undefined || refetchTrips !== undefined;

  useEffect(() => {
    if (pendingScope.current !== scope || !hasReader) {
      pendingScope.current = undefined;
    }
    if (!hasReader) {
      return undefined;
    }

    let hasBeenHidden = document.visibilityState === 'hidden' || pendingScope.current === scope;
    let cycle = 0;
    const handleVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        cycle += 1;
        hasBeenHidden = true;
        pendingScope.current = scope;
        setRefresh({ marks: undefined, scope });
      }
      else if (hasBeenHidden) {
        hasBeenHidden = false;
        cycle += 1;
        const expectedCycle = cycle;
        pendingScope.current = scope;
        setRefresh({ marks: undefined, scope });
        void Promise.allSettled([refetchPicking?.(), refetchReceiving?.(), refetchTrips?.()]).then((results) => {
          if (cycle === expectedCycle) {
            setRefresh({ marks: results.map(result => result.status === 'fulfilled' ? result.value : undefined), scope });
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    if (document.visibilityState === 'visible' && hasBeenHidden) {
      queueMicrotask(() => {
        if (cycle === 0 && pendingScope.current === scope) {
          handleVisibility();
        }
      });
    }

    return (): void => {
      cycle += 1;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [hasReader, refetchPicking, refetchReceiving, refetchTrips, scope]);

  const marks = refresh?.scope === scope ? refresh.marks : undefined;
  const hasPicking = hasAcceptedRefresh(picking, marks?.[0]);
  const hasReceiving = hasAcceptedRefresh(receiving, marks?.[1]);
  const hasTrips = hasAcceptedRefresh(trips, marks?.[2]);
  const isRefreshing = hasReader && refresh?.scope === scope
    && (marks === undefined || !hasPicking || !hasReceiving || !hasTrips);

  useEffect(() => {
    if (!isRefreshing && pendingScope.current === scope) {
      pendingScope.current = undefined;
    }
  }, [isRefreshing, scope]);

  if (refresh !== undefined && !isRefreshing) {
    setRefresh(undefined);
  }

  return isRefreshing;
};
