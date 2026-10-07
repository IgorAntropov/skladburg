import { create } from '@bufbuild/protobuf';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import {
  ErrorCode,
  type ErrorDetail,
} from '@skladburg/contracts/common/v1/error';
import {
  type Event,
  EventSchema,
} from '@skladburg/contracts/event/v1/event';
import {
  organizationChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { EngineChannelPositionValue } from '../core/events/index';
import type { EngineSubscriptionHandlersValue } from './types';

import {
  createHeaders,
  createWarehouseRequest,
} from '../core/engine/testing/engineHarness';
import { callAs } from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import { encodeEvent } from '../protocol/index';
import {
  closeClientHarnesses,
  createClientHarness,
} from './testing/clientHarness';

const KEY_1 = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const KEY_2 = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';

const BUYER_CHANNEL = organizationChannel(SeedOrganizationId.BUYER_1);

const buyerOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);

const createBuyerHeaders = (): Headers => createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);

interface RecordedHandlersValue {
  denied: ErrorDetail[];
  events: (readonly Event[])[];
  handlers: EngineSubscriptionHandlersValue;
  positions: EngineChannelPositionValue[];
}

const createRecordedHandlers = (): RecordedHandlersValue => {
  const denied: ErrorDetail[] = [];
  const events: (readonly Event[])[] = [];
  const positions: EngineChannelPositionValue[] = [];

  return {
    denied,
    events,
    handlers: {
      onDenied: (detail) => {
        denied.push(detail);
      },
      onEvents: (batch) => {
        events.push(batch);
      },
      onSubscribed: (position) => {
        positions.push(position);
      },
    },
    positions,
  };
};

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  closeClientHarnesses();
  vi.restoreAllMocks();
});

describe('connectToEngine subscriptions', () => {
  it('reports the epoch and the position of the channel, then delivers the event of a command as one batch with the next seq', async () => {
    const { connection, createOrganizationClient } = await createClientHarness();
    const recorded = createRecordedHandlers();

    connection.subscribe(BUYER_CHANNEL, createBuyerHeaders(), recorded.handlers);
    await vi.waitFor(() => {
      expect(recorded.positions).toEqual([{ epoch: 'epoch-1', seq: 0n }]);
    });
    await createOrganizationClient(true).createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);
    await vi.waitFor(() => {
      expect(recorded.events).toHaveLength(1);
    });

    const [batch] = recorded.events;
    expect(batch).toHaveLength(1);
    expect(batch?.[0]).toMatchObject({ channel: BUYER_CHANNEL, epoch: 'epoch-1', seq: 1n });
    expect(batch?.[0]?.payload.case).toBe('warehouseChanged');
  });

  it('continues the seq with the next command and keeps one onEvents call per message', async () => {
    const { connection, createOrganizationClient } = await createClientHarness();
    const recorded = createRecordedHandlers();
    connection.subscribe(BUYER_CHANNEL, createBuyerHeaders(), recorded.handlers);

    await createOrganizationClient(true).createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);
    await createOrganizationClient(true).createWarehouse(createWarehouseRequest(KEY_2, { name: 'Склад 10' }), buyerOptions);

    await vi.waitFor(() => {
      expect(recorded.events.map(batch => batch.map(event => event.seq))).toEqual([[1n], [2n]]);
    });
  });

  it('reports the position of the warehouse channel of a just created warehouse as seq 1', async () => {
    const { connection, createOrganizationClient } = await createClientHarness();
    const recorded = createRecordedHandlers();
    const created = await createOrganizationClient(true).createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);

    connection.subscribe(warehouseChannel(created.warehouse?.id ?? ''), createBuyerHeaders(), recorded.handlers);

    await vi.waitFor(() => {
      expect(recorded.positions).toEqual([{ epoch: 'epoch-1', seq: 1n }]);
    });
  });

  it('reports an invalid channel as not_found for the channel entity', async () => {
    const { connection } = await createClientHarness();
    const recorded = createRecordedHandlers();

    connection.subscribe('garbage', createBuyerHeaders(), recorded.handlers);
    connection.subscribe(`user:${SeedUserId.ADMIN_2}`, createBuyerHeaders(), recorded.handlers);

    await vi.waitFor(() => {
      expect(recorded.denied).toHaveLength(2);
    });
    for (const detail of recorded.denied) {
      expect(detail.code).toBe(ErrorCode.NOT_FOUND);
      expect(detail.params.case === 'notFound' ? detail.params.value.entity : undefined).toBe(EntityKind.CHANNEL);
    }

    expect(recorded.positions).toHaveLength(0);
  });

  it('delivers nothing after unsubscribe and tells the engine about it', async () => {
    const { connection, createOrganizationClient, stub } = await createClientHarness();
    const recorded = createRecordedHandlers();
    const unsubscribe = connection.subscribe(BUYER_CHANNEL, createBuyerHeaders(), recorded.handlers);
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    });

    unsubscribe();
    unsubscribe();
    await createOrganizationClient(true).createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);
    const subscriptionId = stub.subscriptionIds()[0] ?? '';
    stub.send({ events: [encodeEvent(create(EventSchema, { seq: 9n }))], subscriptionId, type: 'events' });
    stub.send({ epoch: 'epoch-2', seq: 0n, subscriptionId, type: 'subscribed' });
    await createOrganizationClient(true).listWarehouses({}, buyerOptions);

    expect(recorded.events).toHaveLength(0);
    expect(recorded.positions).toHaveLength(1);
    expect(stub.received.filter(message => message.type === 'unsubscribe')).toEqual([
      { subscriptionId, type: 'unsubscribe' },
    ]);
  });

  it('delivers all events of one message in one call and reports a repeated subscribed message', async () => {
    const { connection, createOrganizationClient, stub } = await createClientHarness();
    const recorded = createRecordedHandlers();
    connection.subscribe(BUYER_CHANNEL, createBuyerHeaders(), recorded.handlers);
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    });
    const subscriptionId = stub.subscriptionIds()[0] ?? '';

    stub.send({ epoch: 'epoch-2', seq: 5n, subscriptionId, type: 'subscribed' });
    stub.send({
      events: [1n, 2n, 3n].map(seq => encodeEvent(create(EventSchema, { channel: BUYER_CHANNEL, epoch: 'epoch-2', seq }))),
      subscriptionId,
      type: 'events',
    });
    await createOrganizationClient(true).listWarehouses({}, buyerOptions);

    expect(recorded.positions).toEqual([{ epoch: 'epoch-1', seq: 0n }, { epoch: 'epoch-2', seq: 5n }]);
    expect(recorded.events).toHaveLength(1);
    expect(recorded.events[0]?.map(event => event.seq)).toEqual([1n, 2n, 3n]);
  });

  it('routes messages to the subscription they belong to', async () => {
    const { connection, createOrganizationClient, stub } = await createClientHarness();
    const first = createRecordedHandlers();
    const second = createRecordedHandlers();
    connection.subscribe(BUYER_CHANNEL, createBuyerHeaders(), first.handlers);
    connection.subscribe(organizationChannel(SeedOrganizationId.BUYER_1), createBuyerHeaders(), second.handlers);
    await vi.waitFor(() => {
      expect(stub.received.filter(message => message.type === 'subscribe')).toHaveLength(2);
    });
    const secondId = stub.subscriptionIds()[1] ?? '';

    stub.send({ events: [encodeEvent(create(EventSchema, { seq: 7n }))], subscriptionId: secondId, type: 'events' });
    await createOrganizationClient(true).listWarehouses({}, buyerOptions);

    expect(first.events).toHaveLength(0);
    expect(second.events).toHaveLength(1);
  });

  it('keeps delivering after a handler throws and logs the failure', async () => {
    const { connection, createOrganizationClient } = await createClientHarness();
    const delivered: bigint[] = [];
    connection.subscribe(BUYER_CHANNEL, createBuyerHeaders(), {
      onDenied: () => undefined,
      onEvents: (batch) => {
        delivered.push(...batch.map(event => event.seq));

        throw new Error('The subscriber failed');
      },
      onSubscribed: () => undefined,
    });

    await createOrganizationClient(true).createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);
    await createOrganizationClient(true).createWarehouse(createWarehouseRequest(KEY_2, { name: 'Склад 10' }), buyerOptions);

    await vi.waitFor(() => {
      expect(delivered).toEqual([1n, 2n]);
    });
    expect(console.log).toHaveBeenCalledWith('> EngineConnection -> invokeHandler:', expect.objectContaining({ handlerName: 'onEvents' }));
  });

  it('ignores a message that cannot be decoded and keeps the subscription alive', async () => {
    const { connection, createOrganizationClient, stub } = await createClientHarness();
    const recorded = createRecordedHandlers();
    connection.subscribe(BUYER_CHANNEL, createBuyerHeaders(), recorded.handlers);
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    });
    const subscriptionId = stub.subscriptionIds()[0] ?? '';

    stub.send({ events: [new Uint8Array([255, 255, 255]).buffer], subscriptionId, type: 'events' });
    stub.sendRaw({ type: 'nonsense' });
    stub.sendRaw('text');
    await createOrganizationClient(true).createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);

    await vi.waitFor(() => {
      expect(recorded.events).toHaveLength(1);
    });
    expect(recorded.events[0]?.[0]?.seq).toBe(1n);
    expect(console.log).toHaveBeenCalledWith('> parseEngineHostMessage -> readHostMessage:', { data: { type: 'nonsense' } });
  });

  it('unsubscribes every subscription on close and subscribes to nothing afterwards', async () => {
    const { connection, stub } = await createClientHarness();
    const recorded = createRecordedHandlers();
    connection.subscribe(BUYER_CHANNEL, createBuyerHeaders(), recorded.handlers);
    connection.subscribe(`user:${SeedUserId.ADMIN_1}`, createBuyerHeaders(), recorded.handlers);
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(2);
    });

    connection.close();
    const afterClose = connection.subscribe(BUYER_CHANNEL, createBuyerHeaders(), recorded.handlers);
    afterClose();

    await vi.waitFor(() => {
      expect(stub.received.filter(message => message.type === 'unsubscribe')).toHaveLength(2);
    });
    expect(stub.received.filter(message => message.type === 'subscribe')).toHaveLength(2);
  });
});
