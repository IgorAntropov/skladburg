import { useEffect } from 'react';

import {
  getTabStorage,
  useActingContext,
} from '@/shared/api';

import type { ReplicaQueueInputValue } from './planReplicas';
import type { SessionEpochValue } from './useSessionEpoch';

import { useDigestQuery } from '../api/useDigestQuery';
import { buildDigestReplica } from '../lib/buildDigestReplica';
import {
  addDigestMark,
  createDigestMark,
  hasDigestMark,
} from '../lib/digestMarks';

export interface UseDigestReplicaOptionsValue {
  dispatch: (input: ReplicaQueueInputValue) => void;
  epoch: SessionEpochValue;
  isQuiet: boolean;
  isReady: boolean;
}

export const useDigestReplica = ({ dispatch, epoch, isQuiet, isReady }: UseDigestReplicaOptionsValue): void => {
  const { organizationId, userId } = useActingContext();
  const { data, dataUpdatedAt } = useDigestQuery();

  useEffect(() => {
    const isFresh = data !== undefined && dataUpdatedAt > epoch.startedAtMs;

    if (!isReady || !isFresh || organizationId === undefined || userId === undefined) {
      return;
    }

    const storage = getTabStorage(window);
    const mark = createDigestMark(userId, organizationId);

    if (hasDigestMark(storage, mark)) {
      return;
    }

    addDigestMark(storage, mark);

    const replica = buildDigestReplica(data.items, `digest:${mark}:${String(epoch.count)}`);

    console.log('> useDigestReplica -> tell:', { hasReplica: replica !== undefined, mark });

    if (replica !== undefined) {
      dispatch({ isQuiet, kind: 'enqueue', replicas: [replica] });
    }
  }, [data, dataUpdatedAt, dispatch, epoch, isQuiet, isReady, organizationId, userId]);
};
