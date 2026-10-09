import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { organizationChannel } from '@skladburg/contracts/runtime';
import {
  createInProcessEngineConnection,
  SeedOrganizationId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { RealtimeBatchValue } from '../realtime/realtimeTypes';
import type { IEngineConnection } from '../transport/demo';
import type { ApiRuntimeValue } from './apiRuntimeTypes';

import { createIdempotencyKey } from '../idempotency/createIdempotencyKey';
import { createManualFrameScheduler } from '../realtime/testing/createManualFrameScheduler';
import { createApiRuntime } from './createApiRuntime';

const CUSTOMER_CHANNEL = organizationChannel(SeedOrganizationId.CUSTOMER_1);

const closers: (() => Promise<void>)[] = [];

interface RealtimeHarnessValue {
  frames: ReturnType<typeof createManualFrameScheduler>;
  inProcess: ReturnType<typeof createInProcessEngineConnection>;
  runtime: ApiRuntimeValue;
  waitForSubscribed: () => Promise<void>;
}

const startRuntime = async (): Promise<RealtimeHarnessValue> => {
  const inProcess = createInProcessEngineConnection();
  const frames = createManualFrameScheduler();
  let notifySubscribed = (): void => undefined;
  const subscribed = new Promise<void>((resolve) => {
    notifySubscribed = resolve;
  });
  const connection: IEngineConnection = {
    ...inProcess.connection,
    subscribe: (channel, headers, handlers) => inProcess.connection.subscribe(channel, headers, {
      ...handlers,
      onSubscribed: (position) => {
        handlers.onSubscribed(position);
        notifySubscribed();
      },
    }),
  };
  const runtime = await createApiRuntime({
    connection,
    defaultOrganizationId: SeedOrganizationId.CUSTOMER_1,
    frameScheduler: frames.scheduler,
  });
  let isClosed = false;

  const close = async (): Promise<void> => {
    if (isClosed) {
      return;
    }

    isClosed = true;
    runtime.close();
    await inProcess.close();
  };

  closers.push(close);

  return { frames, inProcess, runtime, waitForSubscribed: () => subscribed };
};

const waitForPendingFrame = async (frames: RealtimeHarnessValue['frames']): Promise<void> => {
  await vi.waitFor(() => {
    expect(frames.isPending()).toBe(true);
  });
};

afterEach(async () => {
  for (const close of closers.splice(0)) {
    await close();
  }
});

describe('createApiRuntime realtime channel with the demo engine', () => {
  it('delivers one batch with one event after a warehouse is created', async () => {
    const { frames, runtime, waitForSubscribed } = await startRuntime();
    const batches: RealtimeBatchValue[] = [];
    runtime.realtime.subscribe(CUSTOMER_CHANNEL, (batch) => {
      batches.push(batch);
    });
    await waitForSubscribed();
    const { warehouses } = await runtime.client.organization.listWarehouses({});
    const [template] = warehouses;

    const response = await runtime.client.organization.createWarehouse({
      address: 'ул. Вымышленная, 1',
      boardNodeId: template?.boardNodeId ?? '',
      capabilities: [],
      cityId: template?.cityId ?? '',
      idempotencyKey: createIdempotencyKey(),
      name: 'Склад для события',
      timeZone: 'Europe/Moscow',
    });
    await waitForPendingFrame(frames);

    expect(batches).toEqual([]);

    frames.flushFrame();

    expect(batches).toHaveLength(1);
    const [batch] = batches;
    expect(batch?.kind).toBe('events');
    const events = batch?.kind === 'events' ? batch.events : [];
    expect(events).toHaveLength(1);
    expect(events.at(0)?.channel).toBe(CUSTOMER_CHANNEL);
    expect(events.at(0)?.payload.case).toBe('warehouseChanged');
    expect(events.at(0)?.payload.value).toMatchObject({ warehouseId: response.warehouse?.id });
  });

  it('delivers a denied subscription as a batch with the parsed error', async () => {
    const { frames, runtime } = await startRuntime();
    const batches: RealtimeBatchValue[] = [];

    runtime.realtime.subscribe(organizationChannel(SeedOrganizationId.SUPPLIER_1), (batch) => {
      batches.push(batch);
    });
    await waitForPendingFrame(frames);
    frames.flushFrame();

    expect(batches).toHaveLength(1);
    expect(batches.at(0)).toMatchObject({
      error: { code: ErrorCode.MEMBERSHIP_REQUIRED, isRetryable: false },
      kind: 'denied',
    });
  });

  it('answers a change of the acting context with resync', async () => {
    const { frames, runtime, waitForSubscribed } = await startRuntime();
    const batches: RealtimeBatchValue[] = [];
    runtime.realtime.subscribe(CUSTOMER_CHANNEL, (batch) => {
      batches.push(batch);
    });
    await waitForSubscribed();

    runtime.actingContext.set({ organizationId: SeedOrganizationId.CUSTOMER_1, userId: SeedUserId.STOREKEEPER_1 });
    frames.flushFrame();

    expect(batches).toEqual([{ kind: 'resync' }]);
  });

  it('leaves no timers behind after the runtime and the engine are closed', async () => {
    const { frames, inProcess, runtime, waitForSubscribed } = await startRuntime();
    runtime.realtime.subscribe(CUSTOMER_CHANNEL, () => undefined);
    await waitForSubscribed();
    await runtime.client.organization.listWarehouses({});

    runtime.close();
    await inProcess.close();

    expect(frames.isPending()).toBe(false);
    expect(inProcess.pendingTimerCount()).toBe(0);
  });
});
