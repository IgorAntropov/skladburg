import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { EventSchema } from '@skladburg/contracts/event/v1/event';
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

import type { EngineProbeValue } from './testing/engineProbe';
import type { HostHarnessValue } from './testing/hostHarness';

import { createEngine } from '../core/engine/createEngine';
import {
  createHeaders,
  createWarehouseRequest,
  settleMicrotasks,
} from '../core/engine/testing/engineHarness';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../core/modules/testing/moduleHarness';
import {
  SeedOrganizationId,
  SeedUserId,
} from '../core/seed/index';
import {
  DemoPersonaGroup,
  DemoPersonaKind,
} from '../core/state/index';
import { ENGINE_LOCK_NAME } from './constants';
import { createProbeLoader } from './testing/engineProbe';
import {
  countMessages,
  createHostHarness,
  readLastStatus,
  readStatuses,
} from './testing/hostHarness';
import {
  WAIT_OPTIONS,
  waitForInbox,
  waitForRole,
} from './testing/hostScenario';
import { subscribeRecorded } from './testing/recordedSubscription';

const KEY_1 = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const KEY_2 = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';

const BUYER_CHANNEL = organizationChannel(SeedOrganizationId.BUYER_1);
const buyerOptions = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);
const createBuyerHeaders = (): Headers => createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.BUYER_1);

let harness: HostHarnessValue;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  harness = createHostHarness();
});

afterEach(async () => {
  await harness.close();
  vi.restoreAllMocks();
});

describe('engine host as the only tab', () => {
  it('becomes the leader and reports the epoch and the storage kind', async () => {
    const fixture = harness.addHost();

    await waitForRole(fixture, 'leader');

    const statuses = readStatuses(fixture);
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toMatchObject({ coordination: 'shared', role: 'leader', storage: 'memory', storageHealth: 'ok' });
    expect(statuses[0]?.epoch).not.toBe('');
    expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(true);
  });

  it.each([true, false])('answers Connect calls through the port (binary format: %s)', async (useBinaryFormat) => {
    const fixture = harness.addHost();

    const response = await fixture.organization(useBinaryFormat).listWarehouses({}, buyerOptions);

    expect(response.warehouses).toHaveLength(3);
  });

  it('answers a permission error with the error detail and its parameters', async () => {
    const fixture = harness.addHost();

    const error = await captureError(fixture.organization().createWarehouse(
      createWarehouseRequest(KEY_1),
      callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.BUYER_1),
    ));

    const detail = readErrorDetail(error);
    expect(error).toBeInstanceOf(ConnectError);
    expect(error.code).toBe(Code.PermissionDenied);
    expect(detail.code).toBe(ErrorCode.PERMISSION_DENIED);
  });

  it('answers a request only after the commit of the storage finished', async () => {
    const fixture = harness.addHost();
    await fixture.organization().listWarehouses({}, buyerOptions);
    const release = harness.storage.gateCommits();
    let isAnswered = false;

    const call = fixture.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions).then(() => {
      isAnswered = true;
    });
    await vi.waitFor(() => {
      expect(harness.storage.commits).toHaveLength(0);
    }, WAIT_OPTIONS);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(isAnswered).toBe(false);

    release();
    await call;

    expect(harness.storage.commits).toHaveLength(1);
  });

  it('lists the personas of the engine', async () => {
    const fixture = harness.addHost();

    const personas = await fixture.connection.control.listPersonas();

    expect(personas.length).toBeGreaterThan(0);
    expect(personas.some(persona => persona.kind === DemoPersonaKind.BUYER)).toBe(true);

    const buyer = personas.find(persona => persona.kind === DemoPersonaKind.BUYER);

    expect(buyer?.group).toBe(DemoPersonaGroup.FRESH);
    expect(buyer?.userDisplayName).toBe('Анна Смирнова');
    expect(buyer?.roleName).toBe('Администратор');
  });
});

describe('engine host requests before the engine is ready', () => {
  interface GatedStorageValue {
    open: () => void;
    openStorage: () => Promise<{ kind: 'memory'; storage: HostHarnessValue['storage'] }>;
  }

  const createGatedStorage = (): GatedStorageValue => {
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });

    return {
      open,
      openStorage: async () => {
        await gate;

        return { kind: 'memory', storage: harness.storage };
      },
    };
  };

  it('holds a call and a subscription until the engine is ready and then serves both', async () => {
    const gated = createGatedStorage();
    const fixture = harness.addHost({ openStorage: gated.openStorage });
    const recorded = subscribeRecorded(fixture, BUYER_CHANNEL, createBuyerHeaders());
    const call = fixture.organization().listWarehouses({}, buyerOptions);
    await settleMicrotasks();

    expect(readLastStatus(fixture)).toBeUndefined();
    expect(recorded.positions).toHaveLength(0);

    gated.open();

    expect((await call).warehouses).toHaveLength(3);
    expect(recorded.positions).toHaveLength(1);
    expect(readLastStatus(fixture)?.role).toBe('leader');
  });

  it('does not execute a command that is aborted before the engine is ready', async () => {
    const gated = createGatedStorage();
    const fixture = harness.addHost({ openStorage: gated.openStorage });
    const controller = new AbortController();

    const aborted = captureError(fixture.organization().createWarehouse(createWarehouseRequest(KEY_1), {
      ...buyerOptions,
      signal: controller.signal,
    }));
    await waitForInbox(fixture, 'request');
    controller.abort();
    await waitForInbox(fixture, 'abort');

    expect((await aborted).code).toBe(Code.Canceled);

    gated.open();
    await waitForRole(fixture, 'leader');
    const listed = await fixture.organization().listWarehouses({}, buyerOptions);

    expect(listed.warehouses).toHaveLength(3);
    expect(harness.storage.commits).toHaveLength(0);
  });
});

describe('engine host aborts and shutdown', () => {
  it('does not send the response of a command that is aborted while the engine executes it', async () => {
    const probes: EngineProbeValue[] = [];
    const fixture = harness.addHost({ loadCore: createProbeLoader(probes) });
    await waitForRole(fixture, 'leader');
    const release = probes[0]?.holdHandle() ?? (() => undefined);
    const controller = new AbortController();

    const aborted = captureError(fixture.organization().listWarehouses({}, { ...buyerOptions, signal: controller.signal }));
    await vi.waitFor(() => {
      expect(probes[0]?.handleCount()).toBe(1);
    }, WAIT_OPTIONS);
    controller.abort();
    await waitForInbox(fixture, 'abort');
    release();
    await fixture.organization().listWarehouses({}, buyerOptions);

    expect((await aborted).code).toBe(Code.Canceled);
    expect(countMessages(fixture, 'response')).toBe(1);
  });

  it('does not become the leader when it is stopped while the engine starts, and frees the lock', async () => {
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const fixture = harness.addHost({
      openStorage: async () => {
        await gate;

        return { kind: 'memory', storage: harness.storage };
      },
    });
    await vi.waitFor(() => {
      expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(true);
    }, WAIT_OPTIONS);

    const stopping = fixture.stop();
    open();
    await stopping;

    expect(readLastStatus(fixture)).toBeUndefined();
    expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(false);
    expect(harness.timers.activeCount()).toBe(0);
  });

  it('ignores a second stop call', async () => {
    const probes: EngineProbeValue[] = [];
    const fixture = harness.addHost({ loadCore: createProbeLoader(probes) });
    await waitForRole(fixture, 'leader');

    await Promise.all([fixture.host.stop(), fixture.host.stop()]);

    expect(probes[0]?.checkpointCount()).toBe(1);
  });
});

describe('engine host subscriptions', () => {
  it('reports the epoch and the seq of the channel, and the first batch continues with the next seq', async () => {
    const fixture = harness.addHost();
    const recorded = subscribeRecorded(fixture, BUYER_CHANNEL, createBuyerHeaders());
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);

    await fixture.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);
    await vi.waitFor(() => {
      expect(recorded.events).toHaveLength(1);
    }, WAIT_OPTIONS);

    const [position] = recorded.positions;
    const [batch] = recorded.events;
    expect(position?.epoch).toBe(readLastStatus(fixture)?.epoch);
    expect(batch?.[0]?.seq).toBe((position?.seq ?? 0n) + 1n);
    expect(batch?.[0]?.payload.case).toBe('warehouseChanged');
  });

  it('reports seq 1 for the warehouse channel of a just created warehouse', async () => {
    const fixture = harness.addHost();
    const created = await fixture.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);

    const recorded = subscribeRecorded(fixture, warehouseChannel(created.warehouse?.id ?? ''), createBuyerHeaders());

    await vi.waitFor(() => {
      expect(recorded.positions.map(position => position.seq)).toEqual([1n]);
    }, WAIT_OPTIONS);
  });

  it('denies an invalid channel with not_found for the channel entity', async () => {
    const fixture = harness.addHost();

    const recorded = subscribeRecorded(fixture, 'garbage', createBuyerHeaders());

    await vi.waitFor(() => {
      expect(recorded.denied).toHaveLength(1);
    }, WAIT_OPTIONS);
    const [detail] = recorded.denied;
    expect(detail?.code).toBe(ErrorCode.NOT_FOUND);
    expect(detail?.params.case === 'notFound' ? detail.params.value.entity : undefined).toBe(EntityKind.CHANNEL);
  });

  it('sends one events message per subscription for the event of a command', async () => {
    const fixture = harness.addHost();
    const first = subscribeRecorded(fixture, BUYER_CHANNEL, createBuyerHeaders());
    const second = subscribeRecorded(fixture, BUYER_CHANNEL, createBuyerHeaders());
    await vi.waitFor(() => {
      expect(first.positions).toHaveLength(1);
      expect(second.positions).toHaveLength(1);
    }, WAIT_OPTIONS);

    await fixture.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);
    await fixture.organization().createWarehouse(createWarehouseRequest(KEY_2, { name: 'Склад 10' }), buyerOptions);

    await vi.waitFor(() => {
      expect(first.events).toHaveLength(2);
      expect(second.events).toHaveLength(2);
    }, WAIT_OPTIONS);
    expect(countMessages(fixture, 'events')).toBe(4);
  });

  it('delivers nothing after unsubscribe', async () => {
    const fixture = harness.addHost();
    const recorded = subscribeRecorded(fixture, BUYER_CHANNEL, createBuyerHeaders());
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);

    recorded.unsubscribe();
    await fixture.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);
    await fixture.organization().listWarehouses({}, buyerOptions);

    expect(countMessages(fixture, 'events')).toBe(0);
  });
});

describe('engine host event batches', () => {
  const probes: EngineProbeValue[] = [];

  const createEvents = (seqs: readonly bigint[]): ReturnType<typeof create<typeof EventSchema>>[] =>
    seqs.map(seq => create(EventSchema, { channel: BUYER_CHANNEL, seq }));

  beforeEach(() => {
    probes.length = 0;
  });

  it('sends the events of one command as one message per subscription', async () => {
    const fixture = harness.addHost({ loadCore: createProbeLoader(probes) });
    const recorded = subscribeRecorded(fixture, BUYER_CHANNEL, createBuyerHeaders());
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);

    probes[0]?.emitDuring('handle', BUYER_CHANNEL, [createEvents([1n]), createEvents([2n, 3n]), createEvents([4n])]);
    await fixture.organization().listWarehouses({}, buyerOptions);

    await vi.waitFor(() => {
      expect(recorded.events).toHaveLength(1);
    }, WAIT_OPTIONS);
    expect(recorded.events[0]?.map(event => event.seq)).toEqual([1n, 2n, 3n, 4n]);
    expect(countMessages(fixture, 'events')).toBe(1);
  });

  it('sends the events of one tick as one message per subscription and nothing for an empty tick', async () => {
    const fixture = harness.addHost({ loadCore: createProbeLoader(probes) });
    const recorded = subscribeRecorded(fixture, BUYER_CHANNEL, createBuyerHeaders());
    await vi.waitFor(() => {
      expect(recorded.positions).toHaveLength(1);
    }, WAIT_OPTIONS);

    harness.timers.advance(250);
    await vi.waitFor(() => {
      expect(probes[0]?.tickCount()).toBe(1);
    }, WAIT_OPTIONS);
    await settleMicrotasks();

    expect(countMessages(fixture, 'events')).toBe(0);

    probes[0]?.emitDuring('tick', BUYER_CHANNEL, [createEvents([1n]), createEvents([2n])]);
    harness.timers.advance(250);

    await vi.waitFor(() => {
      expect(recorded.events).toHaveLength(1);
    }, WAIT_OPTIONS);
    expect(recorded.events[0]?.map(event => event.seq)).toEqual([1n, 2n]);
    expect(countMessages(fixture, 'events')).toBe(1);
  });
});

describe('engine host ticks and checkpoints', () => {
  const probes: EngineProbeValue[] = [];

  beforeEach(() => {
    probes.length = 0;
  });

  it('ticks the engine every 250 ms of the timer and never overlaps two ticks', async () => {
    const fixture = harness.addHost({ loadCore: createProbeLoader(probes) });
    await waitForRole(fixture, 'leader');
    const release = probes[0]?.holdTick() ?? (() => undefined);

    harness.timers.advance(250);
    harness.timers.advance(250);
    harness.timers.advance(250);
    await settleMicrotasks();

    expect(probes[0]?.tickCount()).toBe(1);

    release();
    await settleMicrotasks();
    harness.timers.advance(250);
    await settleMicrotasks();

    expect(probes[0]?.tickCount()).toBe(2);
  });

  it('does not tick before the timer fires and survives a failing tick', async () => {
    const fixture = harness.addHost({
      loadCore: () => Promise.resolve({
        createEngine: async (options) => {
          const engine = await createEngine(options);
          let isFirst = true;

          return {
            ...engine,
            tick: () => {
              if (isFirst) {
                isFirst = false;

                return Promise.reject(new Error('The task failed'));
              }

              return engine.tick();
            },
          };
        },
      }),
    });
    await waitForRole(fixture, 'leader');

    harness.timers.advance(249);
    harness.timers.advance(1);
    await settleMicrotasks();
    harness.timers.advance(250);
    await settleMicrotasks();

    expect(vi.mocked(console.log).mock.calls.some(call => call[0] === '> EngineHost -> runTick:')).toBe(true);
    expect(harness.timers.activeCount()).toBeGreaterThan(0);
  });

  it('writes a checkpoint every 5 seconds and one more when the host stops, so the world time survives', async () => {
    const fixture = harness.addHost({ loadCore: createProbeLoader(probes) });
    await waitForRole(fixture, 'leader');
    const startMs = (await harness.storage.load())?.meta.worldTimeMs ?? 0;

    harness.realTime.advance(4_000);
    harness.timers.advance(4_999);
    await settleMicrotasks();

    expect(probes[0]?.checkpointCount()).toBe(0);

    harness.timers.advance(1);
    await vi.waitFor(() => {
      expect(probes[0]?.checkpointCount()).toBe(1);
    }, WAIT_OPTIONS);
    await settleMicrotasks();

    expect((await harness.storage.load())?.meta.worldTimeMs).toBe(startMs + 4_000);

    harness.realTime.advance(1_500);
    await fixture.stop();

    expect(probes[0]?.checkpointCount()).toBe(2);
    expect((await harness.storage.load())?.meta.worldTimeMs).toBe(startMs + 5_500);
  });

  it('starts the next engine on the stored world time and not earlier', async () => {
    const first = harness.addHost({ loadCore: createProbeLoader(probes) });
    await waitForRole(first, 'leader');
    harness.realTime.advance(7_000);
    await first.stop();
    const storedMs = (await harness.storage.load())?.meta.worldTimeMs ?? 0;

    const second = harness.addHost({ loadCore: createProbeLoader(probes) });
    await waitForRole(second, 'leader');

    expect(probes).toHaveLength(2);
    expect(probes[1]?.engine.getClockSnapshot().worldTimeMs).toBeGreaterThanOrEqual(storedMs);
  });

  it('stops the timers and releases the lock when the host stops', async () => {
    const fixture = harness.addHost();
    await waitForRole(fixture, 'leader');

    await fixture.stop();

    expect(harness.timers.activeCount()).toBe(0);
    expect(harness.lockManager.isHeld(ENGINE_LOCK_NAME)).toBe(false);
  });
});

describe('engine host reset', () => {
  it('replaces the world, announces the new epoch and re-issues every subscription', async () => {
    const fixture = harness.addHost();
    const created = await fixture.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);
    const warehouseId = created.warehouse?.id ?? '';
    const organization = subscribeRecorded(fixture, BUYER_CHANNEL, createBuyerHeaders());
    const warehouse = subscribeRecorded(fixture, warehouseChannel(warehouseId), createBuyerHeaders());
    const resetEpochs: string[] = [];
    fixture.connection.control.onReset((epoch) => {
      resetEpochs.push(epoch);
    });
    await vi.waitFor(() => {
      expect(organization.positions).toHaveLength(1);
      expect(warehouse.positions).toHaveLength(1);
    }, WAIT_OPTIONS);
    const epochBefore = readLastStatus(fixture)?.epoch;

    await fixture.connection.control.reset();

    await vi.waitFor(() => {
      expect(organization.positions).toHaveLength(2);
    }, WAIT_OPTIONS);
    const epochAfter = readLastStatus(fixture)?.epoch;
    expect(epochAfter).not.toBe(epochBefore);
    expect(resetEpochs).toEqual([epochAfter]);
    expect(organization.positions[1]).toEqual({ epoch: epochAfter, seq: 0n });
    expect(warehouse.denied).toHaveLength(1);
    expect(warehouse.denied[0]?.code).toBe(ErrorCode.NOT_FOUND);
    expect((await fixture.organization().listWarehouses({}, buyerOptions)).warehouses).toHaveLength(3);
  });

  it('delivers the events of the world after the reset to the re-issued subscription', async () => {
    const fixture = harness.addHost();
    const recorded = subscribeRecorded(fixture, BUYER_CHANNEL, createBuyerHeaders());
    await fixture.organization().createWarehouse(createWarehouseRequest(KEY_1), buyerOptions);
    await vi.waitFor(() => {
      expect(recorded.events).toHaveLength(1);
    }, WAIT_OPTIONS);

    await fixture.connection.control.reset();
    await fixture.organization().createWarehouse(createWarehouseRequest(KEY_2), buyerOptions);

    await vi.waitFor(() => {
      expect(recorded.events).toHaveLength(2);
    }, WAIT_OPTIONS);
    expect(recorded.events[1]?.[0]?.seq).toBe(1n);
    expect(recorded.events[1]?.[0]?.epoch).toBe(readLastStatus(fixture)?.epoch);
  });
});

describe('engine host storage fallbacks', () => {
  it('reports memory storage when the storage cannot be opened', async () => {
    const fixture = harness.addHost({ openStorage: () => Promise.reject(new Error('IndexedDB is not available')) });

    await waitForRole(fixture, 'leader');

    expect(readLastStatus(fixture)?.storage).toBe('memory');
    expect((await fixture.organization().listWarehouses({}, buyerOptions)).warehouses).toHaveLength(3);
  });
});
