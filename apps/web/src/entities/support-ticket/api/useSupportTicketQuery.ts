import type { GetSupportTicketResponse } from '@skladburg/contracts/support/v1/support_ticket';
import type { UseQueryResult } from '@tanstack/react-query';

import { useQuery } from '@tanstack/react-query';

import {
  useActingContext,
  useApiClient,
} from '@/shared/api';

import { createSupportTicketQueryOptions } from './supportTicketQueryOptions';

export const useSupportTicketQuery = (ticketId: string | undefined): UseQueryResult<GetSupportTicketResponse> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  return useQuery(createSupportTicketQueryOptions({ client, organizationId, ticketId, userId }));
};
