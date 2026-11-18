import type { WarehouseTopology } from '@skladburg/contracts/wms/v1/topology';

import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  layoutChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import { WarehouseLayoutSessionService } from '@skladburg/contracts/wms/v1/layout_session';
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  isReadAccessDenied,
  useActingContext,
  useApiClient,
  useRealtimeChannel,
} from '@/shared/api';

import type { WarehouseRackFootprintValue } from '../model/warehouseRackGrid';

import { hasWarehouseRackOrigin } from '../model/warehouseRackGrid';
import { warehouseWorkspaceKey } from './warehouseWorkspaceKey';

export interface WarehouseLayoutPreviewValue {
  baseRevision: number;
  expiresAtMs: number;
  footprint: WarehouseRackFootprintValue;
  rowId: string;
  zoneId: string;
}

interface LayoutSubscriptionValue {
  isDenied: boolean;
  scope: string;
}

interface WarehouseLayoutDraftsValue {
  drafts: readonly WarehouseLayoutPreviewValue[];
  error: Error | null;
  isDenied: boolean;
  isLoading: boolean;
  isRetrying: boolean;
  retry: () => void;
}

const EMPTY_DRAFTS: readonly WarehouseLayoutPreviewValue[] = [];

export const useWarehouseLayoutDrafts = (
  topology: null | WarehouseTopology,
  warehouseId: string,
): WarehouseLayoutDraftsValue => {
  const { organizationId, userId } = useActingContext();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const realtime = useRealtimeChannel();
  const [subscription, setSubscription] = useState<LayoutSubscriptionValue>();
  const [nowMs, setNowMs] = useState(() => performance.now());
  const queryKey = useMemo(
    () => [...warehouseWorkspaceKey({ organizationId, userId, warehouseId }), 'layoutDrafts'],
    [organizationId, userId, warehouseId],
  );
  const scope = JSON.stringify(queryKey);
  const channel = layoutChannel(warehouseId);
  const canSubscribe = organizationId !== undefined && userId !== undefined;
  const isSubscribed = subscription?.scope === scope;
  const isSubscriptionDenied = isSubscribed && subscription.isDenied;
  const query = useQuery({
    enabled: canSubscribe && isSubscribed && !isSubscriptionDenied,
    meta: { channels: [warehouseChannel(warehouseId)], eventCases: ['warehouseChanged'] },
    queryFn: async ({ signal }): Promise<readonly WarehouseLayoutPreviewValue[]> => {
      const requestedAtMs = performance.now();
      const result = await client.service(WarehouseLayoutSessionService).getWarehouseLayoutDrafts({ warehouseId }, { signal });
      if (result.serverTime === undefined) {
        return EMPTY_DRAFTS;
      }

      const serverMs = timestampMs(result.serverTime);
      return result.drafts.flatMap(({ baseRevision, expiresAt, footprint, rowId, zoneId }) => {
        if (expiresAt === undefined || !hasWarehouseRackOrigin(footprint)) {
          return [];
        }

        const expiresAtMs = requestedAtMs + timestampMs(expiresAt) - serverMs;
        return expiresAtMs <= performance.now() ? [] : [{ baseRevision, expiresAtMs, footprint, rowId, zoneId }];
      });
    },
    queryKey,
    refetchOnWindowFocus: 'always',
  });
  const isDenied = isSubscriptionDenied || isReadAccessDenied(query.error);
  const revision = topology?.revision;
  const drafts = useMemo(
    () => isDenied || !isSubscribed
      ? EMPTY_DRAFTS
      : query.data?.filter(draft => draft.baseRevision === revision && draft.expiresAtMs > nowMs) ?? EMPTY_DRAFTS,
    [isDenied, isSubscribed, nowMs, query.data, revision],
  );
  const nextExpiryMs = drafts.reduce((deadline, draft) => Math.min(deadline, draft.expiresAtMs), Infinity);
  const retry = (): void => {
    void query.refetch();
  };

  useEffect(() => {
    if (!canSubscribe) {
      return undefined;
    }

    return realtime.subscribe(channel, (batch) => {
      if (batch.kind === 'denied') {
        setSubscription({ isDenied: true, scope });
      }
      else if (batch.kind === 'resync' || batch.events.some(({ payload }) => payload.case === 'warehouseLayoutDraftsChanged')) {
        const filter = { exact: true, queryKey };
        void queryClient.cancelQueries(filter).then(() => queryClient.invalidateQueries(filter));
      }
    }, () => {
      setSubscription({ isDenied: false, scope });
    });
  }, [canSubscribe, channel, queryClient, queryKey, realtime, scope]);

  useEffect(() => {
    if (!Number.isFinite(nextExpiryMs)) {
      return undefined;
    }

    const handleExpiry = (): void => {
      setNowMs(performance.now());
      void queryClient.invalidateQueries({ exact: true, queryKey });
    };
    const deadline = window.setTimeout(handleExpiry, Math.max(0, Math.ceil(nextExpiryMs - performance.now())));

    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        setNowMs(performance.now());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return (): void => {
      window.clearTimeout(deadline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [nextExpiryMs, queryClient, queryKey]);

  return { drafts, error: query.error, isDenied, isLoading: query.isPending, isRetrying: query.isFetching, retry };
};
