import type { QueryClient } from '@tanstack/react-query';

import type {
  ApiQueryMetaValue,
  RealtimeEventCaseValue,
} from './apiQueryMetaTypes';

const isQueryAffectedByEvents = (
  meta: ApiQueryMetaValue,
  eventCases: ReadonlySet<RealtimeEventCaseValue> | undefined,
): boolean => {
  if (eventCases === undefined || meta.eventCases === undefined) {
    return true;
  }

  return meta.eventCases.some(eventCase => eventCases.has(eventCase));
};

export const invalidateQueriesByChannel = (
  queryClient: QueryClient,
  channel: string,
  eventCases: ReadonlySet<RealtimeEventCaseValue> | undefined,
): Promise<void> => queryClient.invalidateQueries({
  predicate: (query) => {
    const { meta } = query;

    return meta?.channels?.includes(channel) === true && isQueryAffectedByEvents(meta, eventCases);
  },
});
