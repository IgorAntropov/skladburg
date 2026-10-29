import { useEffect } from 'react';

import type { ErrorJournalEntryValue } from '@/shared/api';

import {
  translateApiError,
  useErrorJournal,
} from '@/shared/api';
import { useI18n } from '@/shared/i18n';

import type { ReplicaQueueInputValue } from './planReplicas';

import { buildErrorReplica } from '../lib/buildErrorReplica';

export interface UseErrorReplicasOptionsValue {
  canCallSupport: boolean;
  dispatch: (input: ReplicaQueueInputValue) => void;
  isQuiet: boolean;
  isReady: boolean;
}

export const useErrorReplicas = ({ canCallSupport, dispatch, isQuiet, isReady }: UseErrorReplicasOptionsValue): void => {
  const journal = useErrorJournal();
  const { t } = useI18n();

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }

    const translateReason = ({ code, params, traceId }: ErrorJournalEntryValue): string => {
      return translateApiError(t, { code, isRetryable: false, params, traceId });
    };

    return journal.subscribe((entry) => {
      const replica = buildErrorReplica(entry, translateReason, canCallSupport);

      console.log('> useErrorReplicas -> refused:', { code: entry.code, hasReplica: replica !== undefined });

      if (replica !== undefined) {
        dispatch({ isQuiet, kind: 'enqueue', replicas: [replica] });
      }
    });
  }, [canCallSupport, dispatch, isQuiet, isReady, journal, t]);
};
