import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  type GetSupportTicketRequest,
  type GetSupportTicketResponse,
  GetSupportTicketResponseSchema,
  type ListMySupportTicketsRequest,
  type ListMySupportTicketsResponse,
  ListMySupportTicketsResponseSchema,
  SupportTicketSchema,
  SupportTicketService,
} from '@skladburg/contracts/support/v1/support_ticket';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import type { ApiRuntimeValue } from '@/shared/api';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from '@/shared/api/index.testing';

import { supportTicketKeys } from './supportTicketKeys';
import { useMySupportTicketsQuery } from './useMySupportTicketsQuery';
import { useSupportTicketQuery } from './useSupportTicketQuery';

const TICKET_ID = '3b9d4c1e-5a2f-4e7b-9c10-0f6a8d2e4b77';

const createHarness = (): {
  getSupportTicket: Mock<(request: GetSupportTicketRequest) => GetSupportTicketResponse>;
  listMySupportTickets: Mock<(request: ListMySupportTicketsRequest) => ListMySupportTicketsResponse>;
  queryClient: ReturnType<typeof createQueryClient>;
  runtime: ApiRuntimeValue;
  wrapper: (props: { children: ReactNode }) => ReactElement;
} => {
  const listMySupportTickets = vi.fn((_request: ListMySupportTicketsRequest) => create(ListMySupportTicketsResponseSchema, {
    tickets: [create(SupportTicketSchema, { id: TICKET_ID, number: 7 })],
  }));
  const getSupportTicket = vi.fn((_request: GetSupportTicketRequest) => create(GetSupportTicketResponseSchema, {
    ticket: create(SupportTicketSchema, { id: TICKET_ID, number: 7 }),
  }));
  const runtime = createTestRuntime({
    routes: router => router.service(SupportTicketService, { getSupportTicket, listMySupportTickets }),
  });
  const queryClient = createQueryClient({ networkMode: 'always' });

  return {
    getSupportTicket,
    listMySupportTickets,
    queryClient,
    runtime,
    wrapper: ({ children }) => (
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiRuntimeProvider>
    ),
  };
};

describe('support ticket queries', () => {
  afterEach(() => {
    cleanup();
  });

  it('requests the first page of my tickets under the organization key and listens to the user channel', async () => {
    const { listMySupportTickets, queryClient, wrapper } = createHarness();

    const { result } = renderHook(useMySupportTicketsQuery, { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: supportTicketKeys.mine(TEST_ORGANIZATION_ID) });

    expect(query?.meta).toEqual({ channels: [`user:${TEST_USER_ID}`] });
    expect(listMySupportTickets).toHaveBeenCalledTimes(1);
    expect(listMySupportTickets.mock.calls[0]?.[0].page?.pageSize).toBe(30);
    expect(result.current.data?.tickets[0]?.number).toBe(7);
  });

  it('does not request my tickets without the acting context', () => {
    const { listMySupportTickets, queryClient, runtime, wrapper } = createHarness();
    runtime.actingContext.set({ organizationId: undefined, userId: undefined });

    const { result } = renderHook(useMySupportTicketsQuery, { wrapper });
    const query = queryClient.getQueryCache().find({ exact: true, queryKey: supportTicketKeys.mine('none') });

    expect(listMySupportTickets).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(query?.meta).toEqual({ channels: [] });
  });

  it('requests a ticket by id under the organization key and listens to the user channel', async () => {
    const { getSupportTicket, queryClient, wrapper } = createHarness();

    const { result } = renderHook(() => useSupportTicketQuery(TICKET_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({
      exact: true,
      queryKey: supportTicketKeys.detail(TEST_ORGANIZATION_ID, TICKET_ID),
    });

    expect(query?.meta).toEqual({ channels: [`user:${TEST_USER_ID}`] });
    expect(getSupportTicket.mock.calls[0]?.[0].ticketId).toBe(TICKET_ID);
  });

  it('does not request a ticket without an id', () => {
    const { getSupportTicket, wrapper } = createHarness();

    const { result } = renderHook(() => useSupportTicketQuery(undefined), { wrapper });

    expect(getSupportTicket).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('does not request a ticket without the acting context', () => {
    const { getSupportTicket, runtime, wrapper } = createHarness();
    runtime.actingContext.set({ organizationId: undefined, userId: undefined });

    const { result } = renderHook(() => useSupportTicketQuery(TICKET_ID), { wrapper });

    expect(getSupportTicket).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
