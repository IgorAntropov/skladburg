import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  type CreateSupportTicketRequest,
  type CreateSupportTicketResponse,
  CreateSupportTicketResponseSchema,
  DeviceBrowserFamily,
  DeviceFormFactor,
  DeviceOsFamily,
  SupportDeviceSchema,
  SupportTicketCategory,
  SupportTicketContextSchema,
  SupportTicketSchema,
  SupportTicketService,
} from '@skladburg/contracts/support/v1/support_ticket';
import {
  type QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  renderHook,
  type RenderHookResult,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';

import type { CommandValue } from '@/shared/api';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';

import { supportTicketKeys } from './supportTicketKeys';
import { useCreateSupportTicket } from './useCreateSupportTicket';

const TICKET_ID = '3b9d4c1e-5a2f-4e7b-9c10-0f6a8d2e4b77';

const CONTEXT = create(SupportTicketContextSchema, {
  appVersion: 'dev',
  device: create(SupportDeviceSchema, {
    browserFamily: DeviceBrowserFamily.SAFARI,
    formFactor: DeviceFormFactor.PHONE,
    osFamily: DeviceOsFamily.IOS,
  }),
  screenPath: '/network',
});

interface HookPropsValue {
  category: SupportTicketCategory | undefined;
  onSuccess?: ((response: CreateSupportTicketResponse) => void) | undefined;
}

const setup = (createSupportTicket: (request: CreateSupportTicketRequest) => CreateSupportTicketResponse): {
  invalidate: MockInstance<QueryClient['invalidateQueries']>;
  render: RenderHookResult<CommandValue, HookPropsValue>;
} => {
  const runtime = createTestRuntime({
    routes: router => router.service(SupportTicketService, { createSupportTicket }),
  });
  const queryClient = createQueryClient({ networkMode: 'always' });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  const initialProps: HookPropsValue = { category: SupportTicketCategory.GENERAL };

  const render = renderHook(
    ({ category, onSuccess }: HookPropsValue) => useCreateSupportTicket({ category, context: CONTEXT, onSuccess }),
    { initialProps, wrapper: Wrapper },
  );

  return { invalidate, render };
};

const createResponse = (): CreateSupportTicketResponse => create(CreateSupportTicketResponseSchema, {
  ticket: create(SupportTicketSchema, { id: TICKET_ID, number: 1 }),
});

describe('useCreateSupportTicket', () => {
  afterEach(() => {
    cleanup();
  });

  it('sends the category and the context that are current at run, refreshes tickets and reports success', async () => {
    const createSupportTicket = vi.fn((_request: CreateSupportTicketRequest) => createResponse());
    const onSuccess = vi.fn((_response: CreateSupportTicketResponse) => undefined);
    const { invalidate, render } = setup(createSupportTicket);

    render.rerender({ category: SupportTicketCategory.MONEY, onSuccess });

    act(() => {
      render.result.current.run();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    const request = createSupportTicket.mock.calls[0]?.[0];

    expect(request?.category).toBe(SupportTicketCategory.MONEY);
    expect(request?.context?.screenPath).toBe('/network');
    expect(request?.context?.device?.osFamily).toBe(DeviceOsFamily.IOS);
    expect(request?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: supportTicketKeys.all });
    expect(onSuccess.mock.calls[0]?.[0].ticket?.id).toBe(TICKET_ID);
  });

  it('does not call the server without a category', async () => {
    const createSupportTicket = vi.fn((_request: CreateSupportTicketRequest) => createResponse());
    const { render } = setup(createSupportTicket);

    render.rerender({ category: undefined });

    act(() => {
      render.result.current.run();
    });

    await waitFor(() => {
      expect(render.result.current.apiError).toBeDefined();
    });

    expect(createSupportTicket).not.toHaveBeenCalled();
  });

  it('retries with the same key and takes a new key when the category changes after a failure', async () => {
    const createSupportTicket = vi.fn((_request: CreateSupportTicketRequest): CreateSupportTicketResponse => {
      throw new ConnectError('unavailable', Code.Unavailable);
    });
    const { render } = setup(createSupportTicket);

    act(() => {
      render.result.current.run();
    });
    await waitFor(() => {
      expect(render.result.current.apiError?.isRetryable).toBe(true);
    });

    act(() => {
      render.result.current.run();
    });
    await waitFor(() => {
      expect(createSupportTicket).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(render.result.current.isPending).toBe(false);
    });

    render.rerender({ category: SupportTicketCategory.ERROR });

    act(() => {
      render.result.current.run();
    });
    await waitFor(() => {
      expect(createSupportTicket).toHaveBeenCalledTimes(3);
    });

    const [first, second, third] = createSupportTicket.mock.calls.map(([request]) => request.idempotencyKey);

    expect(second).toBe(first);
    expect(third).not.toBe(first);
  });
});
