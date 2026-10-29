import type { ListMySupportTicketsResponse } from '@skladburg/contracts/support/v1/support_ticket';
import type { UseQueryResult } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';

import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { createMySupportTicketsQueryOptions } from './supportTicketQueryOptions';

export const useMySupportTicketsQuery = (): UseQueryResult<ListMySupportTicketsResponse> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  return useQuery(createMySupportTicketsQueryOptions({ client, organizationId, userId }));
};
