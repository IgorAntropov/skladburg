import { useMemo } from 'react';

import type { ProfileSummaryStateValue } from '../model/profileSummaryTypes';

import { selectProfileSummary } from '../lib/selectProfileSummary';
import { useSessionQuery } from './useSessionQuery';

const ERROR_STATE: ProfileSummaryStateValue = { kind: 'error' };
const PENDING_STATE: ProfileSummaryStateValue = { kind: 'pending' };

export const useProfileSummary = (): ProfileSummaryStateValue => {
  const { data: session, isError } = useSessionQuery();

  return useMemo((): ProfileSummaryStateValue => {
    if (session !== undefined) {
      const summary = selectProfileSummary(session);

      return summary === undefined ? ERROR_STATE : { kind: 'ready', summary };
    }

    return isError ? ERROR_STATE : PENDING_STATE;
  }, [isError, session]);
};
