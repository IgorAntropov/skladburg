import type { QueryClient } from '@tanstack/react-query';

import './apiQueryMetaTypes';

export const invalidateQueriesByChannel = (queryClient: QueryClient, channel: string): Promise<void> => queryClient.invalidateQueries({
  predicate: query => query.meta?.channels?.includes(channel) === true,
});
