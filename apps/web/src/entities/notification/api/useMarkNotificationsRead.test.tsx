import type {
  ListNotificationsResponse,
  MarkAllNotificationsReadRequest,
  MarkAllNotificationsReadResponse,
  MarkNotificationsReadRequest,
  MarkNotificationsReadResponse,
} from '@skladburg/contracts/notification/v1/notification';
import type { QueryClient } from '@tanstack/react-query';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ListNotificationsResponseSchema,
  MarkAllNotificationsReadResponseSchema,
  MarkNotificationsReadResponseSchema,
  NotificationSchema,
  NotificationService,
} from '@skladburg/contracts/notification/v1/notification';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from '@/shared/api/index.testing';

import { notificationKeys } from './notificationKeys';
import { useMarkAllNotificationsRead } from './useMarkAllNotificationsRead';
import { useMarkNotificationsRead } from './useMarkNotificationsRead';
import { useNotificationsQuery } from './useNotificationsQuery';
import { useUnreadNotificationCount } from './useUnreadNotificationCount';

const FIRST_ID = 'f0000021-0000-4000-8000-000000000000';
const SECOND_ID = 'f0000022-0000-4000-8000-000000000000';
const THIRD_ID = 'f0000023-0000-4000-8000-000000000000';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const createListResponse = (): ListNotificationsResponse => create(ListNotificationsResponseSchema, {
  notifications: [
    create(NotificationSchema, { id: FIRST_ID }),
    create(NotificationSchema, { id: SECOND_ID }),
    create(NotificationSchema, { id: THIRD_ID, readAt: timestampFromMs(1_000) }),
  ],
  unreadCount: 2,
});

interface GateValue {
  open: () => void;
  wait: Promise<void>;
}

const createGate = (): GateValue => {
  let open = (): void => undefined;
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { open, wait };
};

interface HandlersValue {
  listNotifications: ReturnType<typeof vi.fn<() => Promise<ListNotificationsResponse>>>;
  markAllNotificationsRead: ReturnType<
    typeof vi.fn<(request: MarkAllNotificationsReadRequest) => Promise<MarkAllNotificationsReadResponse>>
  >;
  markNotificationsRead: ReturnType<
    typeof vi.fn<(request: MarkNotificationsReadRequest) => Promise<MarkNotificationsReadResponse>>
  >;
}

const createHandlers = (): HandlersValue => ({
  listNotifications: vi.fn(() => Promise.resolve(createListResponse())),
  markAllNotificationsRead: vi.fn(() => Promise.resolve(create(MarkAllNotificationsReadResponseSchema, {}))),
  markNotificationsRead: vi.fn(() => Promise.resolve(create(MarkNotificationsReadResponseSchema, { unreadCount: 1 }))),
});

const handleMarkAllSuccess = vi.fn();

const useNotificationsHarness = (): {
  list: ReturnType<typeof useNotificationsQuery>;
  markAll: ReturnType<typeof useMarkAllNotificationsRead>;
  markFirst: ReturnType<typeof useMarkNotificationsRead>;
  unreadCount: ReturnType<typeof useUnreadNotificationCount>;
} => ({
  list: useNotificationsQuery(),
  markAll: useMarkAllNotificationsRead({ onSuccess: handleMarkAllSuccess }),
  markFirst: useMarkNotificationsRead([FIRST_ID]),
  unreadCount: useUnreadNotificationCount(),
});

const renderNotifications = (
  handlers: HandlersValue,
): { queryClient: QueryClient; result: { current: ReturnType<typeof useNotificationsHarness> } } => {
  const runtime = createTestRuntime({ routes: router => router.service(NotificationService, handlers) });
  const queryClient = createQueryClient({ networkMode: 'always' });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  const { result } = renderHook(useNotificationsHarness, { wrapper: Wrapper });

  return { queryClient, result };
};

const listKey = notificationKeys.list(TEST_ORGANIZATION_ID);

const readCache = (queryClient: QueryClient): ListNotificationsResponse | undefined => {
  return queryClient.getQueryData<ListNotificationsResponse>(listKey);
};

describe('notification queries and read commands', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    handleMarkAllSuccess.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('requests the first page of 30 once for the list and the counter and listens to the user channel', async () => {
    const handlers = createHandlers();
    const { queryClient, result } = renderNotifications(handlers);

    await waitFor(() => {
      expect(result.current.unreadCount.data).toBe(2);
    });

    expect(result.current.list.data?.notifications).toHaveLength(3);
    expect(handlers.listNotifications).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryCache().find({ exact: true, queryKey: listKey })?.meta).toEqual({
      channels: [`user:${TEST_USER_ID}`],
    });
  });

  it('marks the notification as read in the cache before the server answers and refetches after', async () => {
    const handlers = createHandlers();
    const gate = createGate();

    handlers.markNotificationsRead.mockImplementation(async () => {
      await gate.wait;

      return create(MarkNotificationsReadResponseSchema, { unreadCount: 1 });
    });

    const { queryClient, result } = renderNotifications(handlers);

    await waitFor(() => {
      expect(result.current.unreadCount.data).toBe(2);
    });

    act(() => {
      result.current.markFirst.run();
    });

    await waitFor(() => {
      expect(readCache(queryClient)?.unreadCount).toBe(1);
    });

    expect(readCache(queryClient)?.notifications[0]?.readAt).toBeDefined();
    expect(result.current.markFirst.isPending).toBe(true);
    expect(handlers.listNotifications).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.open();
      await gate.wait;
    });

    await waitFor(() => {
      expect(handlers.listNotifications).toHaveBeenCalledTimes(2);
    });

    const [request] = handlers.markNotificationsRead.mock.calls[0] ?? [];

    expect(request?.notificationIds).toEqual([FIRST_ID]);
    expect(request?.idempotencyKey).toMatch(UUID_PATTERN);
    await waitFor(() => {
      expect(result.current.markFirst.isPending).toBe(false);
    });
  });

  it('rolls the cache back when the server rejects the command', async () => {
    const handlers = createHandlers();
    const gate = createGate();
    const refetchGate = createGate();

    handlers.markNotificationsRead.mockImplementation(async () => {
      await gate.wait;

      throw new ConnectError('rejected', Code.PermissionDenied);
    });

    const { queryClient, result } = renderNotifications(handlers);

    await waitFor(() => {
      expect(result.current.unreadCount.data).toBe(2);
    });

    handlers.listNotifications.mockImplementation(async () => {
      await refetchGate.wait;

      return createListResponse();
    });

    act(() => {
      result.current.markFirst.run();
    });

    await waitFor(() => {
      expect(readCache(queryClient)?.unreadCount).toBe(1);
    });

    await act(async () => {
      gate.open();
      await gate.wait;
    });

    await waitFor(() => {
      expect(result.current.markFirst.error).not.toBeNull();
    });

    expect(readCache(queryClient)?.unreadCount).toBe(2);
    expect(readCache(queryClient)?.notifications[0]?.readAt).toBeUndefined();

    refetchGate.open();
  });

  it('marks everything as read in the cache and zeroes the counter', async () => {
    const handlers = createHandlers();
    const gate = createGate();

    handlers.markAllNotificationsRead.mockImplementation(async () => {
      await gate.wait;

      return create(MarkAllNotificationsReadResponseSchema, { unreadCount: 0 });
    });

    const { queryClient, result } = renderNotifications(handlers);

    await waitFor(() => {
      expect(result.current.unreadCount.data).toBe(2);
    });

    act(() => {
      result.current.markAll.run();
    });

    await waitFor(() => {
      expect(result.current.unreadCount.data).toBe(0);
    });

    expect(readCache(queryClient)?.notifications.every(notification => notification.readAt !== undefined)).toBe(true);
    expect(handleMarkAllSuccess).not.toHaveBeenCalled();

    await act(async () => {
      gate.open();
      await gate.wait;
    });

    await waitFor(() => {
      expect(handleMarkAllSuccess).toHaveBeenCalledTimes(1);
    });
    expect(handlers.markAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(handlers.markAllNotificationsRead.mock.calls[0]?.[0].idempotencyKey).toMatch(UUID_PATTERN);
  });
});
