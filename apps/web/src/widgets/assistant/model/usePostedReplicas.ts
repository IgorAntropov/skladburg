import { userChannel } from '@skladburg/contracts/runtime';
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useNotificationsQuery } from '@/entities/notification';
import {
  useActingContext,
  useRealtimeChannel,
} from '@/shared/api';

import type { AwaitedNotificationValue } from '../lib/selectPostedNotifications';
import type { ReplicaQueueInputValue } from './planReplicas';

import { buildNotificationReplica } from '../lib/buildNotificationReplica';
import {
  collectPostedIds,
  selectPostedNotifications,
} from '../lib/selectPostedNotifications';

export interface UsePostedReplicasOptionsValue {
  dispatch: (input: ReplicaQueueInputValue) => void;
  epochCount: number;
  isQuiet: boolean;
  isReady: boolean;
}

export const usePostedReplicas = ({ dispatch, epochCount, isQuiet, isReady }: UsePostedReplicasOptionsValue): void => {
  const realtime = useRealtimeChannel();
  const { userId } = useActingContext();
  const { data, dataUpdatedAt } = useNotificationsQuery();
  const [awaiting, setAwaiting] = useState<readonly AwaitedNotificationValue[]>([]);
  const narratedIdsRef = useRef(new Set<string>());
  const lastEpochCountRef = useRef(epochCount);

  useEffect(() => {
    if (lastEpochCountRef.current === epochCount) {
      return;
    }

    lastEpochCountRef.current = epochCount;
    narratedIdsRef.current.clear();
    setAwaiting([]);
  }, [epochCount]);

  useEffect(() => {
    if (userId === undefined) {
      return undefined;
    }

    return realtime.subscribe(userChannel(userId), (batch) => {
      if (batch.kind !== 'events') {
        return;
      }

      const postedIds = collectPostedIds(batch.events);

      if (postedIds.length === 0) {
        return;
      }

      const postedAtMs = Date.now();

      console.log('> usePostedReplicas -> posted:', { count: postedIds.length });
      setAwaiting(current => [...current, ...postedIds.map(id => ({ id, postedAtMs }))]);
    });
  }, [realtime, userId]);

  useEffect(() => {
    if (!isReady || awaiting.length === 0 || data === undefined) {
      return;
    }

    const { ready, waiting } = selectPostedNotifications({
      awaiting,
      dataUpdatedAtMs: dataUpdatedAt,
      narratedIds: narratedIdsRef.current,
      notifications: data.notifications,
    });

    if (ready.length === 0 && waiting.length === awaiting.length) {
      return;
    }

    for (const notification of ready) {
      narratedIdsRef.current.add(notification.id);
    }

    setAwaiting(waiting);

    if (ready.length > 0) {
      dispatch({ isQuiet, kind: 'enqueue', replicas: ready.map(buildNotificationReplica) });
    }
  }, [awaiting, data, dataUpdatedAt, dispatch, isQuiet, isReady]);
};
