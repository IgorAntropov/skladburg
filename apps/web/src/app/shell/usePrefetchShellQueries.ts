import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { createSessionQueryOptions } from '@/entities/session';
import {
  useActingContext,
  useApiClient,
} from '@/shared/api';
import { createWorldClockQueryOptions } from '@/widgets/top-bar';

const ignoreFailure = (): undefined => undefined;

export const usePrefetchShellQueries = (): void => {
  const queryClient = useQueryClient();
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  useEffect(() => {
    void queryClient.query(createWorldClockQueryOptions(client)).catch(ignoreFailure);

    if (organizationId === undefined || userId === undefined) {
      return;
    }

    void queryClient.query(createSessionQueryOptions({ client, organizationId, userId })).catch(ignoreFailure);
  }, [queryClient, client, organizationId, userId]);
};
