import type {
  GetSupportTicketResponse,
  ListMySupportTicketsResponse,
} from '@skladburg/contracts/support/v1/support_ticket';
import type { UndefinedInitialDataOptions } from '@tanstack/react-query';

import { SupportTicketService } from '@skladburg/contracts/support/v1/support_ticket';
import {
  queryOptions,
  skipToken,
} from '@tanstack/react-query';

import type { ApiClient } from '@/shared/api';

import { getOrganizationScope } from '@/shared/api';

import { supportTicketKeys } from './supportTicketKeys';
import { createSupportTicketQueryMeta } from './supportTicketScope';

export const MY_SUPPORT_TICKETS_PAGE_SIZE = 30;

const NO_TICKET_SCOPE = 'none';

export interface CreateMySupportTicketsQueryOptionsValue {
  client: ApiClient;
  organizationId: string | undefined;
  userId: string | undefined;
}

export interface CreateSupportTicketQueryOptionsValue extends CreateMySupportTicketsQueryOptionsValue {
  ticketId: string | undefined;
}

type MySupportTicketsQueryKeyValue = ReturnType<typeof supportTicketKeys.mine>;

type SupportTicketQueryKeyValue = ReturnType<typeof supportTicketKeys.detail>;

export const createMySupportTicketsQueryOptions = ({
  client,
  organizationId,
  userId,
}: CreateMySupportTicketsQueryOptionsValue): UndefinedInitialDataOptions<
  ListMySupportTicketsResponse,
  Error,
  ListMySupportTicketsResponse,
  MySupportTicketsQueryKeyValue
> => {
  const isContextComplete = organizationId !== undefined && userId !== undefined;

  return queryOptions({
    meta: createSupportTicketQueryMeta(userId),
    queryFn: isContextComplete
      ? (): Promise<ListMySupportTicketsResponse> => client.service(SupportTicketService).listMySupportTickets({
          page: { pageSize: MY_SUPPORT_TICKETS_PAGE_SIZE, pageToken: '' },
        })
      : skipToken,
    queryKey: supportTicketKeys.mine(getOrganizationScope(organizationId)),
  });
};

export const createSupportTicketQueryOptions = ({
  client,
  organizationId,
  ticketId,
  userId,
}: CreateSupportTicketQueryOptionsValue): UndefinedInitialDataOptions<
  GetSupportTicketResponse,
  Error,
  GetSupportTicketResponse,
  SupportTicketQueryKeyValue
> => {
  const isContextComplete = organizationId !== undefined && userId !== undefined && ticketId !== undefined;

  return queryOptions({
    meta: createSupportTicketQueryMeta(userId),
    queryFn: isContextComplete
      ? (): Promise<GetSupportTicketResponse> => client.service(SupportTicketService).getSupportTicket({ ticketId })
      : skipToken,
    queryKey: supportTicketKeys.detail(getOrganizationScope(organizationId), ticketId ?? NO_TICKET_SCOPE),
  });
};
