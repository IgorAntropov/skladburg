import type { QueryClient } from '@tanstack/react-query';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  ObjectKind,
  ObjectLinkSchema,
  ObjectRefSchema,
} from '@skladburg/contracts/common/v1/object_link';
import { EventSchema } from '@skladburg/contracts/event/v1/event';
import {
  ListNotificationsResponseSchema,
  NotificationSchema,
  NotificationService,
} from '@skladburg/contracts/notification/v1/notification';
import {
  NotificationsChange,
  NotificationsChangedSchema,
} from '@skladburg/contracts/notification/v1/notification_events';
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

import type { RealtimeBatchValue } from '@/shared/api';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_USER_ID,
} from '@/shared/api/index.testing';

import type { ReplicaQueueInputValue } from './planReplicas';

import { usePostedReplicas } from './usePostedReplicas';

const STARTER_ID = 'f0000031-0000-4000-8000-000000000000';
const POSTED_ID = 'f0000032-0000-4000-8000-000000000000';
const SITE_ID = 'f0000033-0000-4000-8000-000000000000';

const createChangeBatch = (change: NotificationsChange, notificationId: string): RealtimeBatchValue => ({
  events: [
    create(EventSchema, {
      payload: {
        case: 'notificationsChanged',
        value: create(NotificationsChangedSchema, { change, notificationIds: [notificationId] }),
      },
    }),
  ],
  kind: 'events',
});

const createSiteLink = (): ReturnType<typeof create<typeof ObjectLinkSchema>> => {
  const ref = create(ObjectRefSchema, { id: SITE_ID, kind: ObjectKind.SITE });

  return create(ObjectLinkSchema, { cameraFocus: ref, target: ref });
};

interface HarnessValue {
  dispatch: ReturnType<typeof vi.fn<(input: ReplicaQueueInputValue) => void>>;
  emit: (batch: RealtimeBatchValue) => void;
  list: ReturnType<typeof vi.fn>;
  listPosted: () => void;
  queryClient: QueryClient;
  subscribedChannels: string[];
}

const renderPostedReplicas = (isReady = true): HarnessValue => {
  let isPostedListed = false;
  let listener: ((batch: RealtimeBatchValue) => void) | undefined;
  const subscribedChannels: string[] = [];
  const dispatch = vi.fn<(input: ReplicaQueueInputValue) => void>();
  const list = vi.fn(() => Promise.resolve(create(ListNotificationsResponseSchema, {
    notifications: [
      ...(isPostedListed ? [create(NotificationSchema, { id: POSTED_ID, links: [createSiteLink()] })] : []),
      create(NotificationSchema, { id: STARTER_ID }),
    ],
  })));
  const runtime = {
    ...createTestRuntime({ routes: router => router.service(NotificationService, { listNotifications: list }) }),
    realtime: {
      stop: (): void => undefined,
      subscribe: (channel: string, subscribed: (batch: RealtimeBatchValue) => void): (() => void) => {
        subscribedChannels.push(channel);
        listener = subscribed;

        return (): void => undefined;
      },
    },
  };
  const queryClient = createQueryClient({ networkMode: 'always' });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  renderHook(() => {
    usePostedReplicas({ dispatch, epochCount: 0, isQuiet: false, isReady });
  }, { wrapper: Wrapper });

  return {
    dispatch,
    emit: (batch) => {
      act(() => {
        listener?.(batch);
      });
    },
    list,
    listPosted: () => {
      isPostedListed = true;
    },
    queryClient,
    subscribedChannels,
  };
};

describe('usePostedReplicas', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('listens to the user channel once', async () => {
    const harness = renderPostedReplicas();

    await waitFor(() => {
      expect(harness.list).toHaveBeenCalledTimes(1);
    });

    expect(harness.subscribedChannels).toEqual([`user:${TEST_USER_ID}`]);
  });

  it('tells a posted notification with a map link once it is in the refreshed list', async () => {
    const harness = renderPostedReplicas();

    await waitFor(() => {
      expect(harness.list).toHaveBeenCalledTimes(1);
    });

    harness.emit(createChangeBatch(NotificationsChange.POSTED, POSTED_ID));

    expect(harness.dispatch).not.toHaveBeenCalled();

    harness.listPosted();
    await act(async () => {
      await harness.queryClient.invalidateQueries();
    });

    await waitFor(() => {
      expect(harness.dispatch).toHaveBeenCalledTimes(1);
    });

    const [input] = harness.dispatch.mock.calls[0] ?? [];

    expect(input?.kind).toBe('enqueue');
    expect(input?.kind === 'enqueue' ? input.replicas.map(replica => replica.id) : []).toEqual([`notification:${POSTED_ID}`]);
    expect(input?.kind === 'enqueue' ? input.replicas[0]?.links.map(link => link.kind) : []).toEqual(['map']);
    expect(input?.kind === 'enqueue' ? input.isQuiet : undefined).toBe(false);
  });

  it('does not tell the same notification twice when the list changes again', async () => {
    const harness = renderPostedReplicas();

    await waitFor(() => {
      expect(harness.list).toHaveBeenCalledTimes(1);
    });

    harness.listPosted();
    harness.emit(createChangeBatch(NotificationsChange.POSTED, POSTED_ID));
    await act(async () => {
      await harness.queryClient.invalidateQueries();
    });
    await waitFor(() => {
      expect(harness.dispatch).toHaveBeenCalledTimes(1);
    });

    harness.emit(createChangeBatch(NotificationsChange.POSTED, POSTED_ID));
    await act(async () => {
      await harness.queryClient.invalidateQueries();
    });

    expect(harness.dispatch).toHaveBeenCalledTimes(1);
  });

  it('tells nothing after a resync or a read event and nothing about the starting notifications', async () => {
    const harness = renderPostedReplicas();

    await waitFor(() => {
      expect(harness.list).toHaveBeenCalledTimes(1);
    });

    harness.listPosted();
    harness.emit({ kind: 'resync' });
    harness.emit(createChangeBatch(NotificationsChange.READ, POSTED_ID));
    await act(async () => {
      await harness.queryClient.invalidateQueries();
    });
    await waitFor(() => {
      expect(harness.list).toHaveBeenCalledTimes(2);
    });

    expect(harness.dispatch).not.toHaveBeenCalled();
  });

  it('keeps a posted notification until the texts are ready', async () => {
    const harness = renderPostedReplicas(false);

    await waitFor(() => {
      expect(harness.list).toHaveBeenCalledTimes(1);
    });

    harness.listPosted();
    harness.emit(createChangeBatch(NotificationsChange.POSTED, POSTED_ID));
    await act(async () => {
      await harness.queryClient.invalidateQueries();
    });
    await waitFor(() => {
      expect(harness.list).toHaveBeenCalledTimes(2);
    });

    expect(harness.dispatch).not.toHaveBeenCalled();
  });
});
