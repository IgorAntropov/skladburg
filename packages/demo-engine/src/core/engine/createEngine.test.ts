import type { CallOptions } from '@connectrpc/connect';
import type { GetWorldClockResponse } from '@skladburg/contracts/clock/v1/clock';
import type { Event } from '@skladburg/contracts/event/v1/event';

import {
  create,
  equals,
  fromBinary,
  fromJsonString,
  toBinary,
  toJsonString,
} from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  Code,
  type ConnectError,
} from '@connectrpc/connect';
import {
  MembershipSchema,
  RoleAssignmentSchema,
  RoleSchema,
  UserSchema,
} from '@skladburg/contracts/access/v1/access';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { EventSchema } from '@skladburg/contracts/event/v1/event';
import {
  CreateWarehouseResponseSchema,
  OrganizationSchema,
  WarehouseChange,
} from '@skladburg/contracts/organization/v1/organization';
import {
  organizationChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IRealTimeSource } from '../ports/index';
import type { IDemoEngine } from './engineTypes';
import type { EngineCallerValue } from './testing/engineHarness';

import {
  LEGACY_FIRST_ORGANIZATION_NAME,
  LEGACY_PERSONA_KIND,
} from '../../protocol/testLegacyNames';
import {
  captureError,
  readErrorDetail,
} from '../modules/testing/moduleHarness';
import {
  createSeedSnapshot,
  DEFAULT_ENGINE_SEED,
  SEED_VERSION,
  SeedOrganizationId,
  SeedPersonaId,
  SeedRoleId,
  SeedUserId,
  SeedWarehouseId,
} from '../seed/index';
import {
  createEngineState,
  DemoPersonaKind,
  ENGINE_SCHEMA_VERSION,
  TABLE_DEFINITIONS,
} from '../state/index';
import { createTestWarehouse } from '../state/testRecords';
import { createEngine } from './createEngine';
import {
  createEngineCaller,
  createFakeRealTime,
  createHeaders,
  createSpyStorage,
  createTestEngine,
  createWarehouseRequest,
  settleMicrotasks,
  TEST_ENGINE_EPOCH,
  WORLD_REAL_TIME_START_MS,
} from './testing/engineHarness';

const KEY_1 = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const KEY_2 = '8d14e6a2-0b3c-4f57-9a68-12cd45ef7890';
const KEY_3 = 'c5a3e9f1-7b24-4d86-a0c1-5e9d3b7f2a64';

const failInvalidWarehouse = (caller: EngineCallerValue, key: string): Promise<ConnectError> =>
  captureError(caller.organization.createWarehouse(createWarehouseRequest(key, { name: '' }), customerOptions(caller)));

const readOccurredAtMs = (event: Event | undefined): number | undefined =>
  event?.occurredAt === undefined ? undefined : timestampMs(event.occurredAt);

const readWorldMs = (response: GetWorldClockResponse): number =>
  response.worldTime === undefined ? Number.NaN : timestampMs(response.worldTime);

const customerOptions = (caller: EngineCallerValue): CallOptions =>
  caller.options(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

const readChangedWarehouseId = (event: Event | undefined): string | undefined =>
  event?.payload.case === 'warehouseChanged' ? event.payload.value.warehouseId : undefined;

const subscribeCustomer = (engine: IDemoEngine, events: Event[][]): void => {
  const result = engine.subscribe(
    organizationChannel(SeedOrganizationId.CUSTOMER_1),
    createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
    (batch) => {
      events.push([...batch]);
    },
  );

  expect(result.kind).toBe('subscribed');
};

describe('createEngine startup', () => {
  it('seeds an empty storage and reports the given epoch', async () => {
    const { engine, storage } = await createTestEngine();

    expect(engine.epoch()).toBe(TEST_ENGINE_EPOCH);
    expect(storage.replaceAllCount()).toBe(1);
    expect(await storage.load()).toEqual(createSeedSnapshot());
  });

  it('lists the personas of the seed', async () => {
    const { engine } = await createTestEngine();

    const personas = engine.listPersonas();

    expect(personas.length).toBeGreaterThan(0);
    expect(personas.map(persona => persona.id)).toContain(SeedPersonaId.FRESH_CUSTOMER);
  });

  it('lists the eight seed personas with organization names, ordered by id', async () => {
    const { engine } = await createTestEngine();

    const personas = engine.listPersonas();

    expect(personas.map(persona => persona.id)).toEqual([
      SeedPersonaId.FRESH_CUSTOMER,
      SeedPersonaId.FRESH_SUPPLIER,
      SeedPersonaId.FRESH_CARRIER,
      SeedPersonaId.FRESH_STOREKEEPER,
      SeedPersonaId.CONSTRUCTION_CUSTOMER,
      SeedPersonaId.CONSTRUCTION_SUPPLIER,
      SeedPersonaId.CONSTRUCTION_CARRIER,
      SeedPersonaId.CONSTRUCTION_STOREKEEPER,
    ]);
    expect(personas.map(persona => [persona.kind, persona.organizationName])).toEqual([
      ['customer', 'Заказчик 1'],
      ['supplier', 'Поставщик 1'],
      ['carrier', 'Перевозчик 1'],
      ['storekeeper', 'Заказчик 1'],
      ['customer', 'Заказчик 2'],
      ['supplier', 'Поставщик 3'],
      ['carrier', 'Перевозчик 2'],
      ['storekeeper', 'Заказчик 2'],
    ]);
  });

  it('lists the user name, the group and the role of every seed persona', async () => {
    const { engine } = await createTestEngine();

    expect(engine.listPersonas().map(persona => [persona.group, persona.userDisplayName, persona.roleName])).toEqual([
      ['fresh', 'Анна Смирнова', 'Администратор'],
      ['fresh', 'Сергей Кузнецов', 'Администратор'],
      ['fresh', 'Дмитрий Васильев', 'Администратор'],
      ['fresh', 'Иван Соколов', 'Кладовщик'],
      ['construction', 'Елена Морозова', 'Администратор'],
      ['construction', 'Андрей Новиков', 'Администратор'],
      ['construction', 'Павел Волков', 'Администратор'],
      ['construction', 'Мария Лебедева', 'Кладовщик'],
    ]);
  });

  it('lists the user id of every persona', async () => {
    const { engine } = await createTestEngine();
    const personas = engine.listPersonas();

    expect(personas.map(persona => persona.userId)).toEqual(
      createEngineState(createSeedSnapshot()).read.list('personas').map(persona => persona.userId),
    );
  });

  it('joins the distinct role names of the membership alphabetically and skips a missing role', async () => {
    const seeded = createSeedSnapshot();
    const reader = createEngineState(seeded).read;
    const membership = reader.listBy('memberships', 'userId', SeedUserId.ADMIN_1)[0];
    const adminRole = reader.get('roles', SeedRoleId.ADMIN_CUSTOMER_1);
    const storekeeperRole = reader.get('roles', SeedRoleId.STOREKEEPER_CUSTOMER_1);

    if (membership === undefined || adminRole === undefined || storekeeperRole === undefined) {
      throw new Error('Expected the seed membership and roles');
    }

    const extended = create(MembershipSchema, {
      id: membership.id,
      organizationId: membership.organizationId,
      roleAssignments: [
        storekeeperRole.id,
        adminRole.id,
        adminRole.id,
        '00000000-0000-4000-8000-000000000000',
      ].map(roleId => create(RoleAssignmentSchema, { roleId, warehouseIds: [] })),
      userId: membership.userId,
    });
    const collections = {
      ...seeded.collections,
      memberships: new Map([...seeded.collections.memberships, [membership.id, TABLE_DEFINITIONS.memberships.encode(extended)]]),
    };
    const { engine } = await createTestEngine({ storage: createSpyStorage({ ...seeded, collections }) });

    expect(engine.listPersonas().find(persona => persona.id === SeedPersonaId.FRESH_CUSTOMER)?.roleName).toBe('Администратор, Кладовщик');
  });

  it('leaves the role name empty for a user without a membership in the persona organization', async () => {
    const seeded = createSeedSnapshot();
    const reader = createEngineState(seeded).read;
    const membership = reader.listBy('memberships', 'userId', SeedUserId.STOREKEEPER_1)[0];

    if (membership === undefined) {
      throw new Error('Expected the seed membership');
    }

    const memberships = new Map(seeded.collections.memberships);
    memberships.delete(membership.id);
    const { engine } = await createTestEngine({
      storage: createSpyStorage({ ...seeded, collections: { ...seeded.collections, memberships } }),
    });
    const persona = engine.listPersonas().find(item => item.id === SeedPersonaId.FRESH_STOREKEEPER);

    expect(persona?.roleName).toBe('');
    expect(persona?.userDisplayName).toBe('Иван Соколов');
  });

  it('ignores the membership of the same user in another organization', async () => {
    const seeded = createSeedSnapshot();
    const reader = createEngineState(seeded).read;
    const membership = reader.listBy('memberships', 'userId', SeedUserId.ADMIN_1)[0];

    if (membership === undefined) {
      throw new Error('Expected the seed membership');
    }

    const moved = create(MembershipSchema, {
      id: membership.id,
      organizationId: SeedOrganizationId.SUPPLIER_1,
      roleAssignments: membership.roleAssignments,
      userId: membership.userId,
    });
    const collections = {
      ...seeded.collections,
      memberships: new Map([...seeded.collections.memberships, [membership.id, TABLE_DEFINITIONS.memberships.encode(moved)]]),
    };
    const { engine } = await createTestEngine({ storage: createSpyStorage({ ...seeded, collections }) });

    expect(engine.listPersonas().find(persona => persona.id === SeedPersonaId.FRESH_CUSTOMER)?.roleName).toBe('');
  });

  it('skips a persona whose user is missing and a persona whose organization is missing', async () => {
    const seeded = createSeedSnapshot();
    const users = new Map(seeded.collections.users);
    const organizations = new Map(seeded.collections.organizations);
    users.delete(SeedUserId.ADMIN_2);
    organizations.delete(SeedOrganizationId.CARRIER_1);
    const { engine } = await createTestEngine({
      storage: createSpyStorage({ ...seeded, collections: { ...seeded.collections, organizations, users } }),
    });
    const ids = engine.listPersonas().map(persona => persona.id);

    expect(ids).not.toContain(SeedPersonaId.FRESH_SUPPLIER);
    expect(ids).not.toContain(SeedPersonaId.FRESH_CARRIER);
    expect(ids).toHaveLength(6);
  });

  it('matches every listed organization name with the organization table of the seed', async () => {
    const { engine } = await createTestEngine();
    const seedReader = createEngineState(createSeedSnapshot()).read;

    for (const persona of engine.listPersonas()) {
      expect(persona.organizationName, persona.id).toBe(seedReader.get('organizations', persona.organizationId)?.name);
    }
  });

  it('keeps the organization name out of the stored persona record', () => {
    const seedPersonas = createEngineState(createSeedSnapshot()).read.list('personas');

    expect(seedPersonas).toHaveLength(8);

    for (const persona of seedPersonas) {
      expect(Object.keys(persona).sort()).toEqual(['group', 'id', 'kind', 'organizationId', 'userId']);
    }
  });

  it('starts the world clock at the seed time', async () => {
    const { engine } = await createTestEngine();

    expect(engine.getClockSnapshot()).toEqual({ timeScale: 1, worldTimeMs: DEFAULT_ENGINE_SEED.worldStartMs });
  });

  it('replaces a stored snapshot of another schema version with the seed', async () => {
    const outdated = { ...createSeedSnapshot(), schemaVersion: ENGINE_SCHEMA_VERSION + 1 };
    const storage = createSpyStorage(outdated);

    const { engine } = await createTestEngine({ storage });

    expect(storage.replaceAllCount()).toBe(1);
    expect(await storage.load()).toEqual(createSeedSnapshot());
    const caller = createEngineCaller(engine);
    const response = await caller.organization.listWarehouses({}, customerOptions(caller));
    expect(response.warehouses).toHaveLength(3);
  });

  it('replaces a stored snapshot of the first schema version, which has no scheduler deadlines, with the seed', async () => {
    const outdated = { ...createSeedSnapshot(), schemaVersion: 1 };
    const storage = createSpyStorage(outdated);

    const { engine } = await createTestEngine({ storage });

    expect(storage.replaceAllCount()).toBe(1);
    expect(await storage.load()).toEqual(createSeedSnapshot());
    expect(engine.getClockSnapshot().worldTimeMs).toBe(DEFAULT_ENGINE_SEED.worldStartMs);
  });

  it('replaces a stored snapshot of the current schema but an older seed version with the seed', async () => {
    const seeded = createSeedSnapshot();
    const extraWarehouse = createTestWarehouse('20000000-0000-4000-8000-000000000999', SeedOrganizationId.CUSTOMER_1);
    const collections = {
      ...seeded.collections,
      warehouses: new Map([
        ...seeded.collections.warehouses,
        [extraWarehouse.id, TABLE_DEFINITIONS.warehouses.encode(extraWarehouse)],
      ]),
    };
    const outdated = { ...seeded, collections, meta: { ...seeded.meta, seedVersion: SEED_VERSION - 1 } };
    const storage = createSpyStorage(outdated);

    const { engine } = await createTestEngine({ storage });

    expect(storage.replaceAllCount()).toBe(1);
    expect(await storage.load()).toEqual(seeded);
    const caller = createEngineCaller(engine);
    const response = await caller.organization.listWarehouses({}, customerOptions(caller));
    expect(response.warehouses).toHaveLength(3);
  });

  it('reseeds a snapshot of the previous seed version with the old side names without a parse error', async () => {
    const seeded = createSeedSnapshot();
    const reader = createEngineState(seeded).read;
    const personas = new Map(
      [...seeded.collections.personas].map(([id, stored]) => [
        id,
        Object.fromEntries(Object.entries(stored).map(([key, value]) => [
          key,
          key === 'kind' && value === DemoPersonaKind.CUSTOMER ? LEGACY_PERSONA_KIND : value,
        ])),
      ]),
    );
    const firstCustomer = reader.get('organizations', SeedOrganizationId.CUSTOMER_1);

    if (firstCustomer === undefined) {
      throw new Error('Expected the first customer organization');
    }

    const organizations = new Map(seeded.collections.organizations);
    organizations.set(
      firstCustomer.id,
      TABLE_DEFINITIONS.organizations.encode(create(OrganizationSchema, { ...firstCustomer, name: LEGACY_FIRST_ORGANIZATION_NAME })),
    );
    const previousSeed = {
      ...seeded,
      collections: { ...seeded.collections, organizations, personas },
      meta: { ...seeded.meta, seedVersion: 2 },
    };
    const storage = createSpyStorage(previousSeed);

    const { engine } = await createTestEngine({ storage });

    expect(storage.replaceAllCount()).toBe(1);
    expect(await storage.load()).toEqual(seeded);
    const customerPersona = engine.listPersonas().find(persona => persona.id === SeedPersonaId.FRESH_CUSTOMER);
    expect(customerPersona?.kind).toBe(DemoPersonaKind.CUSTOMER);
    expect(customerPersona?.organizationName).toBe('Заказчик 1');
  });

  it('reseeds the snapshot left by the previous release, with personas without a group and numbered user names', async () => {
    const seeded = createSeedSnapshot();
    const reader = createEngineState(seeded).read;
    const personas = new Map(
      [...seeded.collections.personas].map(([id, stored]) => [
        id,
        Object.fromEntries(Object.entries(stored).filter(([key]) => key !== 'group')),
      ]),
    );
    const users = new Map(seeded.collections.users);

    const previousNames: readonly (readonly [string, string])[] = [
      [SeedUserId.ADMIN_1, 'Администратор 1'],
      [SeedUserId.ADMIN_2, 'Администратор 2'],
    ];

    for (const [userId, displayName] of previousNames) {
      const user = reader.get('users', userId);

      if (user === undefined) {
        throw new Error('Expected the seed user');
      }

      const renamed = create(UserSchema, { ...user, displayName });
      users.set(userId, TABLE_DEFINITIONS.users.encode(renamed));
    }

    const previousRelease = {
      ...seeded,
      collections: { ...seeded.collections, personas, users },
      meta: { ...seeded.meta, seedVersion: SEED_VERSION - 1 },
      schemaVersion: ENGINE_SCHEMA_VERSION - 1,
    };
    const storage = createSpyStorage(previousRelease);

    const { engine } = await createTestEngine({ storage });

    expect(storage.replaceAllCount()).toBe(1);
    expect(await storage.load()).toEqual(seeded);
    const [first] = engine.listPersonas();
    expect(first?.id).toBe(SeedPersonaId.FRESH_CUSTOMER);
    expect(first?.userDisplayName).toBe('Анна Смирнова');
    expect(first?.group).toBe('fresh');
    expect(first?.roleName).toBe('Администратор');
  });

  it('does not reseed a stored snapshot whose schema and seed versions are both current', async () => {
    const seeded = createSeedSnapshot();
    const extraWarehouse = createTestWarehouse('20000000-0000-4000-8000-000000000999', SeedOrganizationId.CUSTOMER_1);
    const collections = {
      ...seeded.collections,
      warehouses: new Map([
        ...seeded.collections.warehouses,
        [extraWarehouse.id, TABLE_DEFINITIONS.warehouses.encode(extraWarehouse)],
      ]),
    };
    const storage = createSpyStorage({ ...seeded, collections });

    const { engine } = await createTestEngine({ storage });

    expect(storage.replaceAllCount()).toBe(0);
    const caller = createEngineCaller(engine);
    const response = await caller.organization.listWarehouses({}, customerOptions(caller));
    expect(response.warehouses).toHaveLength(4);
  });

  it('keeps a stored snapshot of the current version untouched', async () => {
    const storage = createSpyStorage();
    const first = await createTestEngine({ storage });
    const caller = createEngineCaller(first.engine);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    const second = await createTestEngine({ storage });
    const secondCaller = createEngineCaller(second.engine);
    const response = await secondCaller.organization.listWarehouses({}, customerOptions(secondCaller));

    expect(storage.replaceAllCount()).toBe(1);
    expect(response.warehouses).toHaveLength(4);
  });

  it('uses the seed given in the options', async () => {
    const { engine } = await createTestEngine({ seed: { randomSeed: 7, worldStartMs: 5_000 } });

    expect(engine.getClockSnapshot().worldTimeMs).toBe(5_000);
  });
});

describe('world time of a command', () => {
  const FRACTIONAL_REAL_START_MS = 1_800_000_000_000.123;
  const FRACTIONAL_STEP_MS = 0.37;

  const createDriftingRealTime = (): IRealTimeSource => {
    let currentMs = FRACTIONAL_REAL_START_MS;

    return {
      now: () => {
        currentMs += FRACTIONAL_STEP_MS;

        return currentMs;
      },
    };
  };

  it('gives the events and the stored change set of a command one and the same whole world time', async () => {
    const { engine, storage } = await createTestEngine({ realTime: createDriftingRealTime() });
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);

    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    const firstCommit = storage.commits.at(-1);
    const firstEvents = batches.flat();
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(caller));
    const secondCommit = storage.commits.at(-1);
    const secondEvents = batches.flat().slice(firstEvents.length);

    for (const [commit, events] of [[firstCommit, firstEvents], [secondCommit, secondEvents]] as const) {
      expect(events.length).toBeGreaterThan(0);
      expect(Number.isInteger(commit?.meta.worldTimeMs)).toBe(true);
      expect(new Set(events.map(readOccurredAtMs)).size).toBe(1);
      expect(readOccurredAtMs(events[0])).toBe(commit?.meta.worldTimeMs);
    }

    expect(secondCommit?.meta.worldTimeMs).toBeGreaterThanOrEqual(firstCommit?.meta.worldTimeMs ?? Number.POSITIVE_INFINITY);
  });

  it('publishes events that encode and decode without loss for a fractional real time source', async () => {
    const { engine } = await createTestEngine({ realTime: createDriftingRealTime() });
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);

    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    const events = batches.flat();
    expect(events.length).toBeGreaterThan(0);

    for (const event of events) {
      expect(equals(EventSchema, fromBinary(EventSchema, toBinary(EventSchema, event)), event)).toBe(true);
      expect(equals(EventSchema, fromJsonString(EventSchema, toJsonString(EventSchema, event)), event)).toBe(true);
    }
  });
});

describe('events', () => {
  it('publishes one thin event to the organization channel with the next seq, the epoch and the world time', async () => {
    const { engine, realTime } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);

    realTime.advance(2_500);
    const first = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    realTime.advance(1_000);
    const second = await caller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(caller));

    expect(batches).toHaveLength(2);
    const [firstEvent] = batches[0] ?? [];
    const [secondEvent] = batches[1] ?? [];
    expect(batches[0]).toHaveLength(1);
    expect(firstEvent?.channel).toBe(organizationChannel(SeedOrganizationId.CUSTOMER_1));
    expect(firstEvent?.seq).toBe(1n);
    expect(secondEvent?.seq).toBe(2n);
    expect(firstEvent?.epoch).toBe(TEST_ENGINE_EPOCH);
    expect(readOccurredAtMs(firstEvent)).toBe(DEFAULT_ENGINE_SEED.worldStartMs + 2_500);
    expect(readOccurredAtMs(secondEvent)).toBe(DEFAULT_ENGINE_SEED.worldStartMs + 3_500);
    expect(firstEvent?.payload.case).toBe('warehouseChanged');
    expect(readChangedWarehouseId(firstEvent)).toBe(first.warehouse?.id);
    expect(readChangedWarehouseId(secondEvent)).toBe(second.warehouse?.id);
    expect(firstEvent?.payload.case === 'warehouseChanged' ? firstEvent.payload.value.change : undefined).toBe(WarehouseChange.CREATED);
  });

  it('gives the organization channel a thin event without the data of the warehouse', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);

    await caller.organization.createWarehouse(
      createWarehouseRequest(KEY_1, { address: 'ул. Вымышленная, 77', name: 'Склад Секретный' }),
      customerOptions(caller),
    );

    const [event] = batches.flat();
    const text = event === undefined ? '' : toJsonString(EventSchema, event);
    expect(batches.flat()).toHaveLength(1);
    expect(text).not.toContain('Склад Секретный');
    expect(text).not.toContain('ул. Вымышленная, 77');
    expect(text).not.toContain('Europe/Moscow');
  });

  it('writes the sequences of the organization channel and of the new warehouse channel into the change set of one command', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);

    const created = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    expect(storage.commits).toHaveLength(1);
    expect(storage.commits[0]?.meta.channelSeq).toEqual({
      [organizationChannel(SeedOrganizationId.CUSTOMER_1)]: 1n,
      [warehouseChannel(created.warehouse?.id ?? '')]: 1n,
    });
  });

  it('numbers the events of different channels independently', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);

    const first = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    const second = await caller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(caller));
    const third = await caller.organization.createWarehouse(
      createWarehouseRequest(KEY_3),
      caller.options(SeedUserId.ADMIN_5, SeedOrganizationId.CUSTOMER_2),
    );

    const lastCommit = storage.commits.at(-1);
    expect(lastCommit?.meta.channelSeq).toEqual({
      [organizationChannel(SeedOrganizationId.CUSTOMER_1)]: 2n,
      [organizationChannel(SeedOrganizationId.CUSTOMER_2)]: 1n,
      [warehouseChannel(first.warehouse?.id ?? '')]: 1n,
      [warehouseChannel(second.warehouse?.id ?? '')]: 1n,
      [warehouseChannel(third.warehouse?.id ?? '')]: 1n,
    });
    expect(batches.flat().map(event => event.seq)).toEqual([1n, 2n]);
  });

  it('delivers an event only to the subscribers of its channel and stops after unsubscribe', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const customerBatches: Event[][] = [];
    const supplierBatches: Event[][] = [];
    const stopped: Event[][] = [];
    subscribeCustomer(engine, customerBatches);
    const supplier = engine.subscribe(
      organizationChannel(SeedOrganizationId.SUPPLIER_1),
      createHeaders(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1),
      (batch) => {
        supplierBatches.push([...batch]);
      },
    );
    const customer = engine.subscribe(
      organizationChannel(SeedOrganizationId.CUSTOMER_1),
      createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1),
      (batch) => {
        stopped.push([...batch]);
      },
    );
    if (customer.kind === 'subscribed') {
      customer.unsubscribe();
    }

    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    expect(supplier.kind).toBe('subscribed');
    expect(customerBatches).toHaveLength(1);
    expect(supplierBatches).toHaveLength(0);
    expect(stopped).toHaveLength(0);
  });

  it('sends no events when the command fails', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    batches.length = 0;

    const invalid = await captureError(caller.organization.createWarehouse(
      createWarehouseRequest(KEY_2, { name: '' }),
      customerOptions(caller),
    ));
    const forbidden = await captureError(caller.organization.createWarehouse(
      createWarehouseRequest(KEY_2),
      caller.options(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    ));
    const reused = await captureError(caller.organization.createWarehouse(
      createWarehouseRequest(KEY_1, { name: 'Склад 10' }),
      customerOptions(caller),
    ));

    expect(readErrorDetail(invalid).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(readErrorDetail(forbidden).code).toBe(ErrorCode.PERMISSION_DENIED);
    expect(readErrorDetail(reused).code).toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
    expect(batches).toHaveLength(0);
  });

  it('sends one event and no second commit when an idempotent command is repeated', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);

    const first = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    const repeated = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    const list = await caller.organization.listWarehouses({}, customerOptions(caller));

    expect(repeated.warehouse?.id).toBe(first.warehouse?.id);
    expect(list.warehouses).toHaveLength(4);
    expect(batches).toHaveLength(1);
    expect(storage.commits).toHaveLength(1);
  });

  it('keeps delivering to the other listeners and finishes the command when one listener throws', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const headers = createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
    const channel = organizationChannel(SeedOrganizationId.CUSTOMER_1);
    const received: Event[][] = [];
    engine.subscribe(channel, headers, () => {
      throw new Error('listener failed');
    });
    engine.subscribe(channel, headers, (batch) => {
      received.push([...batch]);
    });

    const response = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    expect(response.warehouse?.id).toBeDefined();
    expect(received).toHaveLength(1);
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});

interface DeniedValue {
  code: ErrorCode | undefined;
  entity: EntityKind | undefined;
  warehouseId: string | undefined;
}

type SubscribedValue = Extract<ReturnType<IDemoEngine['subscribe']>, { kind: 'subscribed' }>;

describe('subscription access', () => {
  it('allows a member to subscribe to the organization channel and the own user channel', async () => {
    const { engine } = await createTestEngine();
    const headers = new Headers({ 'x-demo-user-id': SeedUserId.ADMIN_1 });

    expect(engine.subscribe(organizationChannel(SeedOrganizationId.CUSTOMER_1), headers, () => undefined).kind).toBe('subscribed');
    expect(engine.subscribe(`user:${SeedUserId.ADMIN_1}`, headers, () => undefined).kind).toBe('subscribed');
  });

  describe('warehouse channel', () => {
    const MEMBER_USER_ID = '2f000001-0000-4000-8000-000000000000';
    const MEMBER_ROLE_ID = '2f000002-0000-4000-8000-000000000000';
    const MEMBER_MEMBERSHIP_ID = '2f000003-0000-4000-8000-000000000000';
    const UNKNOWN_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

    const customerAdminHeaders = (): Headers => createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

    const readDenied = (result: ReturnType<IDemoEngine['subscribe']>): DeniedValue => {
      if (result.kind !== 'denied') {
        return { code: undefined, entity: undefined, warehouseId: undefined };
      }

      return {
        code: result.detail.code,
        entity: result.detail.params.case === 'notFound' ? result.detail.params.value.entity : undefined,
        warehouseId: result.detail.params.case === 'permissionDenied' ? result.detail.params.value.warehouseId : undefined,
      };
    };

    const createStorageWithMember = (permissions: readonly string[]): ReturnType<typeof createSpyStorage> => {
      const snapshot = createSeedSnapshot();
      const collections = {
        ...snapshot.collections,
        memberships: new Map(snapshot.collections.memberships).set(
          MEMBER_MEMBERSHIP_ID,
          TABLE_DEFINITIONS.memberships.encode(create(MembershipSchema, {
            id: MEMBER_MEMBERSHIP_ID,
            organizationId: SeedOrganizationId.CUSTOMER_1,
            roleAssignments: [{ roleId: MEMBER_ROLE_ID, warehouseIds: [] }],
            userId: MEMBER_USER_ID,
          })),
        ),
        roles: new Map(snapshot.collections.roles).set(
          MEMBER_ROLE_ID,
          TABLE_DEFINITIONS.roles.encode(create(RoleSchema, {
            id: MEMBER_ROLE_ID,
            name: 'Роль без складов',
            permissions: [...permissions],
            tenantId: SeedOrganizationId.CUSTOMER_1,
          })),
        ),
        users: new Map(snapshot.collections.users).set(
          MEMBER_USER_ID,
          TABLE_DEFINITIONS.users.encode(create(UserSchema, { displayName: 'Тестовый пользователь', id: MEMBER_USER_ID })),
        ),
      };

      return createSpyStorage({ ...snapshot, collections });
    };

    it('lets the administrator of the owner organization subscribe to an own and to a just created warehouse', async () => {
      const { engine } = await createTestEngine();
      const caller = createEngineCaller(engine);

      const existing = engine.subscribe(warehouseChannel(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2), customerAdminHeaders(), () => undefined);
      const created = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
      const fresh = engine.subscribe(warehouseChannel(created.warehouse?.id ?? ''), customerAdminHeaders(), () => undefined);

      expect(existing.kind).toBe('subscribed');
      expect(fresh.kind).toBe('subscribed');
    });

    it('lets a storekeeper subscribe to the warehouse of the area and denies another warehouse of the same organization', async () => {
      const { engine } = await createTestEngine();
      const headers = createHeaders(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);

      const own = engine.subscribe(warehouseChannel(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1), headers, () => undefined);
      const other = engine.subscribe(warehouseChannel(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2), headers, () => undefined);

      expect(own.kind).toBe('subscribed');
      expect(readDenied(other)).toEqual({
        code: ErrorCode.PERMISSION_DENIED,
        entity: undefined,
        warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2,
      });
    });

    it('answers not_found for the warehouse of another organization and for an unknown warehouse alike', async () => {
      const { engine } = await createTestEngine();
      const headers = createHeaders(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);

      const foreign = engine.subscribe(warehouseChannel(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1), headers, () => undefined);
      const unknown = engine.subscribe(warehouseChannel(UNKNOWN_ID), headers, () => undefined);

      expect(readDenied(foreign)).toEqual({ code: ErrorCode.NOT_FOUND, entity: EntityKind.WAREHOUSE, warehouseId: undefined });
      expect(readDenied(unknown)).toEqual(readDenied(foreign));
    });

    it('answers session_required without a user', async () => {
      const { engine } = await createTestEngine();

      const result = engine.subscribe(warehouseChannel(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1), new Headers(), () => undefined);

      expect(readDenied(result).code).toBe(ErrorCode.SESSION_REQUIRED);
    });

    it('denies a member without warehouse_view with permission_denied and subscribes a member that has it', async () => {
      const denied = await createTestEngine({ storage: createStorageWithMember(['member_view']) });
      const allowed = await createTestEngine({ storage: createStorageWithMember(['warehouse_view']) });
      const headers = createHeaders(MEMBER_USER_ID, SeedOrganizationId.CUSTOMER_1);
      const channel = warehouseChannel(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1);

      const deniedResult = denied.engine.subscribe(channel, headers, () => undefined);

      expect(readDenied(deniedResult).code).toBe(ErrorCode.PERMISSION_DENIED);
      expect(readDenied(deniedResult).warehouseId).toBe('');
      expect(allowed.engine.subscribe(channel, headers, () => undefined).kind).toBe('subscribed');
    });
  });

  it('denies a user who is not a member of the organization with membership_required', async () => {
    const { engine } = await createTestEngine();
    const headers = new Headers({ 'x-demo-user-id': SeedUserId.ADMIN_1 });

    const result = engine.subscribe(organizationChannel(SeedOrganizationId.SUPPLIER_1), headers, () => undefined);

    expect(result.kind).toBe('denied');
    expect(result.kind === 'denied' ? result.detail.code : undefined).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  });

  it('denies a call without a user with session_required', async () => {
    const { engine } = await createTestEngine();

    const withoutUser = engine.subscribe(organizationChannel(SeedOrganizationId.CUSTOMER_1), new Headers(), () => undefined);
    const unknownUser = engine.subscribe(
      organizationChannel(SeedOrganizationId.CUSTOMER_1),
      new Headers({ 'x-demo-user-id': 'ffffffff-ffff-4fff-8fff-ffffffffffff' }),
      () => undefined,
    );

    expect(withoutUser.kind === 'denied' ? withoutUser.detail.code : undefined).toBe(ErrorCode.SESSION_REQUIRED);
    expect(unknownUser.kind === 'denied' ? unknownUser.detail.code : undefined).toBe(ErrorCode.SESSION_REQUIRED);
  });

  it('denies the channel of another user and unknown channels with not_found', async () => {
    const { engine } = await createTestEngine();
    const headers = new Headers({ 'x-demo-user-id': SeedUserId.ADMIN_1 });

    const results = [`user:${SeedUserId.ADMIN_2}`, 'warehouse:1', 'org:', '', 'org:a:b'].map(
      channel => engine.subscribe(channel, headers, () => undefined),
    );

    expect(results.map(result => (result.kind === 'denied' ? result.detail.code : undefined))).toEqual(
      results.map(() => ErrorCode.NOT_FOUND),
    );
  });

  it('names the channel as the missing entity for the channel of another user and for a malformed channel', async () => {
    const { engine } = await createTestEngine();
    const headers = new Headers({ 'x-demo-user-id': SeedUserId.ADMIN_1 });

    const results = [`user:${SeedUserId.ADMIN_2}`, 'org:', '', 'org:a:b'].map(
      channel => engine.subscribe(channel, headers, () => undefined),
    );

    expect(results.map(result => (
      result.kind === 'denied' && result.detail.params.case === 'notFound' ? result.detail.params.value.entity : undefined
    ))).toEqual(results.map(() => EntityKind.CHANNEL));
  });
});

describe('subscription position', () => {
  const customerChannel = organizationChannel(SeedOrganizationId.CUSTOMER_1);
  const customerHeaders = (): Headers => createHeaders(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

  const subscribeAt = (engine: IDemoEngine, channel: string, batches: Event[][]): SubscribedValue => {
    const result = engine.subscribe(channel, customerHeaders(), (batch) => {
      batches.push([...batch]);
    });

    if (result.kind !== 'subscribed') {
      throw new Error('Expected a subscription');
    }

    return result;
  };

  it('reports the epoch of the engine and zero for a channel without events', async () => {
    const { engine } = await createTestEngine();

    const subscription = subscribeAt(engine, customerChannel, []);

    expect(subscription.epoch).toBe(TEST_ENGINE_EPOCH);
    expect(subscription.seq).toBe(0n);
  });

  it('starts the first batch after a subscription with the next seq of the channel', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(caller));
    const batches: Event[][] = [];

    const subscription = subscribeAt(engine, customerChannel, batches);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_3), customerOptions(caller));

    expect(subscription.seq).toBe(2n);
    expect(batches.flat().map(event => event.seq)).toEqual([subscription.seq + 1n]);
  });

  it('gives a warehouse channel of a just created warehouse the position of its creation event', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const created = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    const subscription = subscribeAt(engine, warehouseChannel(created.warehouse?.id ?? ''), []);

    expect(subscription.seq).toBe(1n);
  });

  it('joins subscriptions made before and after a command without a gap or a repeat', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const earlyBatches: Event[][] = [];
    const lateBatches: Event[][] = [];
    const early = subscribeAt(engine, customerChannel, earlyBatches);

    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    const late = subscribeAt(engine, customerChannel, lateBatches);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(caller));

    expect(early.seq).toBe(0n);
    expect(late.seq).toBe(1n);
    expect(earlyBatches.flat().map(event => event.seq)).toEqual([1n, 2n]);
    expect(lateBatches.flat().map(event => event.seq)).toEqual([late.seq + 1n]);
  });

  it('reports the position before a command that is still being committed and delivers that command next', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    const release = storage.gateCommits();

    const pending = caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    await settleMicrotasks();
    const subscription = subscribeAt(engine, customerChannel, batches);
    release();
    await pending;

    expect(subscription.seq).toBe(0n);
    expect(batches.flat().map(event => event.seq)).toEqual([1n]);
  });

  it('reports the new epoch after a reset and starts the channel over', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    await engine.reset('epoch-2');
    const subscription = subscribeAt(engine, customerChannel, []);

    expect(subscription.epoch).toBe('epoch-2');
    expect(subscription.seq).toBe(0n);
  });
});

describe('checkpoint', () => {
  it('commits one change set without records, carrying the world time of the checkpoint and the unchanged streams', async () => {
    const { engine, realTime, storage } = await createTestEngine();
    const seedMeta = createSeedSnapshot().meta;
    realTime.advance(7_000);

    await engine.checkpoint();

    expect(storage.commits).toHaveLength(1);
    const [commit] = storage.commits;
    expect(commit?.puts).toEqual({});
    expect(commit?.deletes).toEqual({});
    expect(commit?.meta).toEqual({ ...seedMeta, worldTimeMs: DEFAULT_ENGINE_SEED.worldStartMs + 7_000 });
    expect((await storage.load())?.meta.worldTimeMs).toBe(DEFAULT_ENGINE_SEED.worldStartMs + 7_000);
  });

  it('does not commit again while nothing in the meta has changed', async () => {
    const { engine, realTime, storage } = await createTestEngine();
    realTime.advance(1_000);

    await engine.checkpoint();
    await engine.checkpoint();

    expect(storage.commits).toHaveLength(1);

    realTime.advance(1);
    await engine.checkpoint();

    expect(storage.commits).toHaveLength(2);
  });

  it('does not commit when the world time stands still and no command has run', async () => {
    const { engine, storage } = await createTestEngine();

    await engine.checkpoint();

    expect(storage.commits).toHaveLength(0);
  });

  it('does not commit right after a command that stored the same meta', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    await engine.checkpoint();

    expect(storage.commits).toHaveLength(1);
  });

  it('sends no events and does not draw from the random streams', async () => {
    const { engine, realTime, storage } = await createTestEngine();
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);
    const seedMeta = createSeedSnapshot().meta;
    realTime.advance(3_000);

    await engine.checkpoint();

    expect(batches).toHaveLength(0);
    expect(storage.commits[0]?.meta.randomState).toEqual(seedMeta.randomState);
    expect(storage.commits[0]?.meta.traceRandomState).toEqual(seedMeta.traceRandomState);
    expect(storage.commits[0]?.meta.channelSeq).toEqual({});
  });

  it('keeps the ids of the following entities the same as without a checkpoint', async () => {
    const plain = await createTestEngine();
    const plainCaller = createEngineCaller(plain.engine);
    const withCheckpoint = await createTestEngine();
    const checkpointCaller = createEngineCaller(withCheckpoint.engine);
    withCheckpoint.realTime.advance(1_000);

    await withCheckpoint.engine.checkpoint();

    const expected = await plainCaller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(plainCaller));
    const actual = await checkpointCaller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(checkpointCaller));
    expect(actual.warehouse?.id).toBe(expected.warehouse?.id);
  });

  it('runs in the order of the queue, after the command issued before it', async () => {
    const { engine, realTime, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const release = storage.gateCommits();

    const created = caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    await settleMicrotasks();
    realTime.advance(2_000);
    const checkpointed = engine.checkpoint();
    await settleMicrotasks();

    expect(storage.commits).toHaveLength(0);
    release();
    await Promise.all([created, checkpointed]);

    expect(storage.commits).toHaveLength(2);
    expect(Object.keys(storage.commits[0]?.puts ?? {})).not.toHaveLength(0);
    expect(storage.commits[1]?.puts).toEqual({});
    expect(storage.commits[1]?.meta.worldTimeMs).toBeGreaterThan(storage.commits[0]?.meta.worldTimeMs ?? 0);
  });

  it('answers unavailable when the commit fails, keeps the state and writes the meta on the next try', async () => {
    const { engine, realTime, storage } = await createTestEngine();
    realTime.advance(4_000);
    storage.failNextCommit();

    const error = await captureError(engine.checkpoint());

    expect(readErrorDetail(error).code).toBe(ErrorCode.UNAVAILABLE);
    expect(storage.commits).toHaveLength(0);

    await engine.checkpoint();

    expect(storage.commits).toHaveLength(1);
    expect(storage.commits[0]?.meta.worldTimeMs).toBe(DEFAULT_ENGINE_SEED.worldStartMs + 4_000);
  });

  it('lets a restart on the same storage continue the world time from the checkpoint', async () => {
    const storage = createSpyStorage();
    const before = await createTestEngine({ storage });
    before.realTime.advance(9_000);
    await before.engine.checkpoint();

    const realTime = createFakeRealTime(WORLD_REAL_TIME_START_MS * 7);
    const after = await createEngine({ epoch: 'epoch-2', realTime, storage });

    expect(after.getClockSnapshot().worldTimeMs).toBe(DEFAULT_ENGINE_SEED.worldStartMs + 9_000);
  });
});

describe('determinism', () => {
  const runScenario = async (): Promise<{
    errors: string[];
    responses: Uint8Array[];
    snapshot: Awaited<ReturnType<ReturnType<typeof createSpyStorage>['load']>>;
  }> => {
    const { engine, realTime, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const responses: Uint8Array[] = [];
    const errors: string[] = [];

    realTime.advance(1_000);
    const created = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    responses.push(toBinary(CreateWarehouseResponseSchema, created));
    realTime.advance(333);
    const repeated = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    responses.push(toBinary(CreateWarehouseResponseSchema, repeated));
    const second = await caller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(caller));
    responses.push(toBinary(CreateWarehouseResponseSchema, second));

    const failingCalls = [
      (): Promise<unknown> => caller.organization.createWarehouse(createWarehouseRequest(KEY_3, { name: '' }), customerOptions(caller)),
      (): Promise<unknown> => caller.organization.createWarehouse(
        createWarehouseRequest(KEY_3),
        caller.options(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
      ),
      (): Promise<unknown> => caller.organization.listWarehouses({}, caller.options(undefined)),
    ];

    for (const failing of failingCalls) {
      const detail = readErrorDetail(await captureError(failing()));
      errors.push(`${String(detail.code)}:${detail.traceId}`);
    }

    return { errors, responses, snapshot: await storage.load() };
  };

  it('gives the same responses, ids, trace ids and stored snapshot for the same seed and commands', async () => {
    const first = await runScenario();
    const second = await runScenario();

    expect(second.responses).toEqual(first.responses);
    expect(second.errors).toEqual(first.errors);
    expect(second.errors.every(entry => !entry.endsWith(':'))).toBe(true);
    expect(second.snapshot).toEqual(first.snapshot);
  });

  it('gives different ids for a different seed', async () => {
    const first = await createTestEngine();
    const second = await createTestEngine({ seed: { ...DEFAULT_ENGINE_SEED, randomSeed: DEFAULT_ENGINE_SEED.randomSeed + 1 } });
    const firstCaller = createEngineCaller(first.engine);
    const secondCaller = createEngineCaller(second.engine);

    const firstResponse = await firstCaller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(firstCaller));
    const secondResponse = await secondCaller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(secondCaller));

    expect(secondResponse.warehouse?.id).not.toBe(firstResponse.warehouse?.id);
  });

  it('scales the world time by the stored time scale of the clock', async () => {
    const snapshot = createSeedSnapshot();
    const storage = createSpyStorage({ ...snapshot, meta: { ...snapshot.meta, timeScale: 60 } });
    const { engine, realTime } = await createTestEngine({ storage });
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);

    realTime.advance(1_000);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    const expectedWorldMs = DEFAULT_ENGINE_SEED.worldStartMs + 60_000;
    const [event] = batches[0] ?? [];
    expect(engine.getClockSnapshot()).toEqual({ timeScale: 60, worldTimeMs: expectedWorldMs });
    expect(readOccurredAtMs(event)).toBe(expectedWorldMs);
  });

  it('stores the generator state and the world time with the command', async () => {
    const { engine, realTime, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const seedMeta = createSeedSnapshot().meta;

    realTime.advance(4_000);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    const { meta } = (await storage.load()) ?? createSeedSnapshot();
    expect(meta.randomState).not.toEqual(seedMeta.randomState);
    expect(meta.worldTimeMs).toBe(seedMeta.worldTimeMs + 4_000);
  });

  it('continues the same sequence of ids after a restart from the stored state', async () => {
    const continuous = await createTestEngine();
    const continuousCaller = createEngineCaller(continuous.engine);
    await continuousCaller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(continuousCaller));
    const expected = await continuousCaller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(continuousCaller));

    const storage = createSpyStorage();
    const before = await createTestEngine({ storage });
    const beforeCaller = createEngineCaller(before.engine);
    await beforeCaller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(beforeCaller));

    const batches: Event[][] = [];
    const after = await createTestEngine({ storage });
    subscribeCustomer(after.engine, batches);
    const afterCaller = createEngineCaller(after.engine);
    const actual = await afterCaller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(afterCaller));

    expect(actual.warehouse?.id).toBe(expected.warehouse?.id);
    expect(batches.flat().map(event => event.seq)).toEqual([2n]);
  });

  it('keeps the ids of the following entities when errors happen in between', async () => {
    const withoutErrors = await createTestEngine();
    const cleanCaller = createEngineCaller(withoutErrors.engine);
    await cleanCaller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(cleanCaller));
    const expected = await cleanCaller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(cleanCaller));

    const withErrors = await createTestEngine();
    const caller = createEngineCaller(withErrors.engine);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    const missing = await captureError(caller.organization.getOrganization(
      { organizationId: '00000000-0000-4000-8000-000000000999' },
      customerOptions(caller),
    ));
    const invalid = await failInvalidWarehouse(caller, KEY_3);
    const actual = await caller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(caller));

    expect(readErrorDetail(missing).code).toBe(ErrorCode.NOT_FOUND);
    expect(readErrorDetail(invalid).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(actual.warehouse?.id).toBe(expected.warehouse?.id);
  });

  it('gives different trace ids to consecutive errors and the same ones to the same commands', async () => {
    const collectTraceIds = async (): Promise<string[]> => {
      const { engine } = await createTestEngine();
      const caller = createEngineCaller(engine);
      const traceIds: string[] = [];

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const error = await failInvalidWarehouse(caller, KEY_1);
        traceIds.push(readErrorDetail(error).traceId);
      }

      return traceIds;
    };

    const first = await collectTraceIds();
    const second = await collectTraceIds();

    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
    expect(first.every(traceId => traceId !== '')).toBe(true);
  });

  it('stores the trace stream state with the commit and restores it on restart and reset', async () => {
    const storage = createSpyStorage();
    const { engine } = await createTestEngine({ storage });
    const caller = createEngineCaller(engine);
    const seedMeta = createSeedSnapshot().meta;
    await failInvalidWarehouse(caller, KEY_3);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    const stored = (await storage.load())?.meta;
    expect(stored?.traceRandomState).not.toEqual(seedMeta.traceRandomState);

    await engine.reset('epoch-2');

    expect((await storage.load())?.meta.traceRandomState).toEqual(seedMeta.traceRandomState);
    const after = await failInvalidWarehouse(caller, KEY_3);
    const fresh = await createTestEngine();
    const freshCaller = createEngineCaller(fresh.engine);
    const freshError = await failInvalidWarehouse(freshCaller, KEY_3);
    expect(readErrorDetail(after).traceId).toBe(readErrorDetail(freshError).traceId);
  });

  it('restores the world time from the stored state and runs it on from the real time of the new start', async () => {
    const storage = createSpyStorage();
    const before = await createTestEngine({ storage });
    const caller = createEngineCaller(before.engine);
    before.realTime.advance(10_000);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    const realTime = createFakeRealTime(WORLD_REAL_TIME_START_MS * 50);
    const after = await createEngine({ epoch: TEST_ENGINE_EPOCH, realTime, storage });

    expect(after.getClockSnapshot().worldTimeMs).toBe(DEFAULT_ENGINE_SEED.worldStartMs + 10_000);
    realTime.advance(500);
    expect(after.getClockSnapshot().worldTimeMs).toBe(DEFAULT_ENGINE_SEED.worldStartMs + 10_500);
  });
});

describe('world clock', () => {
  it('serves the world time and the scale of the engine clock', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);

    const response = await caller.clock.getWorldClock({}, customerOptions(caller));

    expect(response.timeScale).toBe(1);
    expect(readWorldMs(response)).toBe(DEFAULT_ENGINE_SEED.worldStartMs);
  });

  it('moves the served time with the real time and the stored scale', async () => {
    const snapshot = createSeedSnapshot();
    const storage = createSpyStorage({ ...snapshot, meta: { ...snapshot.meta, timeScale: 60 } });
    const { engine, realTime } = await createTestEngine({ storage });
    const caller = createEngineCaller(engine);

    realTime.advance(2_000);
    const response = await caller.clock.getWorldClock({}, customerOptions(caller));

    expect(response.timeScale).toBe(60);
    expect(readWorldMs(response)).toBe(DEFAULT_ENGINE_SEED.worldStartMs + 120_000);
  });

  it('serves the seed time again after a reset', async () => {
    const { engine, realTime } = await createTestEngine();
    const caller = createEngineCaller(engine);
    realTime.advance(30_000);
    await engine.tick();

    const before = await caller.clock.getWorldClock({}, customerOptions(caller));
    await engine.reset('epoch-2');
    const after = await caller.clock.getWorldClock({}, customerOptions(caller));

    expect(readWorldMs(before)).toBe(DEFAULT_ENGINE_SEED.worldStartMs + 30_000);
    expect(readWorldMs(after)).toBe(DEFAULT_ENGINE_SEED.worldStartMs);
  });

  it('rejects a call without a session', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);

    const error = await captureError(caller.clock.getWorldClock({}, caller.options(undefined)));

    expect(readErrorDetail(error).code).toBe(ErrorCode.SESSION_REQUIRED);
  });
});

describe('reset', () => {
  it('returns the state to the seed, restarts the sequences and sets the new epoch', async () => {
    const { engine, realTime, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);
    realTime.advance(5_000);
    const original = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(caller));
    batches.length = 0;

    await engine.reset('epoch-2');

    expect(engine.epoch()).toBe('epoch-2');
    expect(await storage.load()).toEqual(createSeedSnapshot());
    expect(engine.getClockSnapshot().worldTimeMs).toBe(DEFAULT_ENGINE_SEED.worldStartMs);
    const list = await caller.organization.listWarehouses({}, customerOptions(caller));
    expect(list.warehouses).toHaveLength(3);

    const recreated = await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    const [event] = batches[0] ?? [];
    expect(event?.seq).toBe(1n);
    expect(event?.epoch).toBe('epoch-2');
    expect(recreated.warehouse?.id).toBe(original.warehouse?.id);
    expect(storage.commits.at(-1)?.meta.channelSeq).toEqual({
      [organizationChannel(SeedOrganizationId.CUSTOMER_1)]: 1n,
      [warehouseChannel(recreated.warehouse?.id ?? '')]: 1n,
    });
  });

  it('lets a restart after the reset continue from the seed state', async () => {
    const storage = createSpyStorage();
    const { engine } = await createTestEngine({ storage });
    const caller = createEngineCaller(engine);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    await engine.reset('epoch-2');

    const restarted = await createTestEngine({ storage });
    const restartedCaller = createEngineCaller(restarted.engine);
    const list = await restartedCaller.organization.listWarehouses({}, customerOptions(restartedCaller));

    expect(list.warehouses).toHaveLength(3);
  });

  it('leaves the engine untouched when the storage rejects the reset and resets on the next try', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    storage.failNextReplaceAll();

    await expect(engine.reset('epoch-2')).rejects.toThrow(Error);

    expect(engine.epoch()).toBe(TEST_ENGINE_EPOCH);
    expect((await caller.organization.listWarehouses({}, customerOptions(caller))).warehouses).toHaveLength(4);

    await engine.reset('epoch-2');

    expect(engine.epoch()).toBe('epoch-2');
    expect((await caller.organization.listWarehouses({}, customerOptions(caller))).warehouses).toHaveLength(3);
  });
});

describe('storage commits', () => {
  it('commits exactly once for a successful command', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);

    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    expect(storage.commits).toHaveLength(1);
  });

  it('does not commit for a failed command', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);

    await failInvalidWarehouse(caller, KEY_1);
    await captureError(caller.organization.createWarehouse(createWarehouseRequest(KEY_1), caller.options(undefined)));
    await captureError(caller.organization.createWarehouse(
      createWarehouseRequest(KEY_1),
      caller.options(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1),
    ));

    expect(storage.commits).toHaveLength(0);
  });

  it('does not commit for reads', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);

    await caller.organization.listWarehouses({}, customerOptions(caller));
    await caller.organization.getOrganizationSettings({}, customerOptions(caller));
    await caller.organization.getOrganization({ organizationId: SeedOrganizationId.SUPPLIER_1 }, customerOptions(caller));
    await caller.access.getSession({}, customerOptions(caller));
    await caller.access.listRoles({}, customerOptions(caller));
    await engine.tick();

    expect(storage.commits).toHaveLength(0);
  });

  it('answers unavailable, keeps the state and sends no events when the commit fails, then accepts the retry', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);
    storage.failNextCommit();

    const error = await captureError(caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller)));

    expect(error.code).toBe(Code.Unavailable);
    expect(readErrorDetail(error).code).toBe(ErrorCode.UNAVAILABLE);
    expect(batches).toHaveLength(0);
    const list = await caller.organization.listWarehouses({}, customerOptions(caller));
    expect(list.warehouses).toHaveLength(3);

    await caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));

    expect(batches.flat().map(event => event.seq)).toEqual([1n]);
    expect(storage.commits).toHaveLength(1);
  });
});

describe('sequential queue', () => {
  it('commits in the order the commands were issued and prepares the next one on the committed state', async () => {
    const { engine, storage } = await createTestEngine();
    const caller = createEngineCaller(engine);
    const batches: Event[][] = [];
    subscribeCustomer(engine, batches);
    const release = storage.gateCommits();

    const first = caller.organization.createWarehouse(createWarehouseRequest(KEY_1, { name: 'Склад 11' }), customerOptions(caller));
    const second = caller.organization.createWarehouse(createWarehouseRequest(KEY_2, { name: 'Склад 12' }), customerOptions(caller));
    await settleMicrotasks();

    expect(storage.commits).toHaveLength(0);
    release();
    const [firstResponse, secondResponse] = await Promise.all([first, second]);

    expect(storage.commits).toHaveLength(2);
    expect(batches.flat().map(event => event.seq)).toEqual([1n, 2n]);
    expect(batches.flat().map(readChangedWarehouseId)).toEqual([firstResponse.warehouse?.id, secondResponse.warehouse?.id]);
  });

  it('keeps serving the commands that follow a failed one', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);

    const failed = captureError(caller.organization.createWarehouse(createWarehouseRequest(KEY_1, { name: '' }), customerOptions(caller)));
    const succeeded = caller.organization.createWarehouse(createWarehouseRequest(KEY_2), customerOptions(caller));

    expect(readErrorDetail(await failed).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect((await succeeded).warehouse?.id).toBeDefined();
  });

  it('runs reset and tick in the same order as the commands', async () => {
    const { engine } = await createTestEngine();
    const caller = createEngineCaller(engine);

    const created = caller.organization.createWarehouse(createWarehouseRequest(KEY_1), customerOptions(caller));
    const resetting = engine.reset('epoch-3');
    const listing = caller.organization.listWarehouses({}, customerOptions(caller));
    await Promise.all([created, resetting]);

    expect((await listing).warehouses).toHaveLength(3);
    expect(engine.epoch()).toBe('epoch-3');
  });
});
