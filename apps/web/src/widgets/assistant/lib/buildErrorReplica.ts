import type { ErrorJournalEntryValue } from '@/shared/api';

import type { ReplicaValue } from '../model/replicaTypes';

import { getErrorHintKey } from './getErrorHintKey';

export const buildErrorReplica = (
  entry: ErrorJournalEntryValue,
  translateReason: (entry: ErrorJournalEntryValue) => string,
): ReplicaValue | undefined => {
  const hintKey = getErrorHintKey(entry.code);

  if (hintKey === null) {
    return undefined;
  }

  return {
    body: { hintKey, kind: 'error', reason: translateReason(entry) },
    hasCenterLink: false,
    id: `error:${entry.method}:${String(entry.occurredAt)}:${entry.traceId ?? ''}`,
    importance: 'important',
    links: [],
  };
};
