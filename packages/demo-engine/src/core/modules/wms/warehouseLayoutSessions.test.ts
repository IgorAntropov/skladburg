import type { MessageInitShape } from '@bufbuild/protobuf';
import type { Client } from '@connectrpc/connect';
import type { PutWarehouseLayoutDraftRequest } from '@skladburg/contracts/wms/v1/layout_session';
import type { WarehouseCellInput } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { RoleAssignmentSchema } from '@skladburg/contracts/access/v1/access';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  layoutChannel,
  SUPPORT_SESSION_HEADER,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  PutWarehouseLayoutDraftRequestSchema,
  WarehouseLayoutSessionService,
} from '@skladburg/contracts/wms/v1/layout_session';
import {
  WarehouseCellInputSchema,
  WarehouseTopologyService,
} from '@skladburg/contracts/wms/v1/topology';
import {
  expect,
  it,
} from 'vitest';

import type {
  SpyStorageValue,
  TestEngineValue,
} from '../../engine/testing/engineHarness';

import {
  createEngineTransport,
  createSpyStorage,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SeedMembershipId,
  SeedOrganizationId,
  SeedRoleId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { TABLE_DEFINITIONS } from '../../state/index';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';

const admin = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
const zone = { warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1, zoneId: '8f000002-0000-4000-8000-000000000001' };
const key = (suffix: string): string => `f0000000-0000-4000-8000-0000000000${suffix}`;

interface LayoutSessionHarnessValue extends TestEngineValue {
  first: LayoutTabClientValue;
  second: LayoutTabClientValue;
}

type LayoutTabClientValue = Client<typeof WarehouseLayoutSessionService> & Client<typeof WarehouseTopologyService>;

const setup = async (storage?: SpyStorageValue): Promise<LayoutSessionHarnessValue> => {
  const options = await createTestEngine({ storage });
  const createTabClient = (tabId: string): LayoutTabClientValue => {
    const transport = createEngineTransport(options.engine, true, tabId);

    return { ...createClient(WarehouseTopologyService, transport), ...createClient(WarehouseLayoutSessionService, transport) };
  };

  return { ...options, first: createTabClient('first'), second: createTabClient('second') };
};

const addCell = (zoneCode: string, coordinate: number): MessageInitShape<typeof WarehouseCellInputSchema> => ({
  cellCode: `${zoneCode.trim()}-S02-C01`,
  rackCode: 'S02',
  rackFootprint: { depthMm: 500, origin: { xMm: coordinate, zMm: 1_000 }, widthMm: 600 },
  rowCode: 'R01',
  tierCode: 'Y01',
  tierElevationMm: 0,
  widthMm: 600,
  zoneCode,
});

const rackCells = (coordinate: number): WarehouseCellInput[] => {
  const { rackFootprint } = addCell('Z01', coordinate);

  return [
    { cellCode: 'Z01-R01-S02-Y01-C01', tierCode: 'Y01', tierElevationMm: 0, xOffsetMm: 0 },
    { cellCode: 'Z01-R01-S02-Y01-C02', tierCode: 'Y01', tierElevationMm: 0, xOffsetMm: 300 },
    { cellCode: 'Z01-R01-S02-Y02-C01', tierCode: 'Y02', tierElevationMm: 1_500, xOffsetMm: 0 },
    { cellCode: 'Z01-R01-S02-Y02-C02', tierCode: 'Y02', tierElevationMm: 1_500, xOffsetMm: 300 },
  ].map(cell => create(WarehouseCellInputSchema, {
    ...cell, rackCode: 'S02', rackFootprint, rowCode: 'R01', widthMm: 300, zoneCode: 'Z01',
  }));
};

const prepareDraft = async (first: LayoutTabClientValue): Promise<PutWarehouseLayoutDraftRequest> => {
  const { topology } = await first.getWarehouseTopology({ warehouseId: zone.warehouseId }, admin);
  const row = topology?.storageZones.find(item => item.id === zone.zoneId)?.rows.find(item => item.code === 'R01');
  if (row === undefined) {
    throw new Error('Missing first layout row');
  }

  const { layoutSessionId } = await first.openWarehouseLayoutSession({ ...zone, idempotencyKey: key('10') }, admin);

  return create(PutWarehouseLayoutDraftRequestSchema, {
    ...zone,
    cells: rackCells(6_000),
    expectedDraftRevision: 0,
    expectedRevision: 1,
    idempotencyKey: key('11'),
    layoutSessionId,
    rowId: row.id,
  });
};

it('projects the latest accepted draft, bounds replay and removes the projection on cancellation', async () => {
  const { engine, first, realTime, second, storage } = await setup();
  const observer = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
  const outsider = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
  const request = await prepareDraft(first);
  const scope = { warehouseId: zone.warehouseId };
  const events: string[] = [];
  const listener = engine.subscribe(layoutChannel(zone.warehouseId), new Headers(observer.headers), (batch) => {
    events.push(...batch.map(event => event.payload.case ?? ''));
  });
  expect(listener.kind).toBe('subscribed');
  expect(engine.subscribe(layoutChannel(zone.warehouseId), new Headers(outsider.headers), () => undefined).kind).toBe('denied');
  const support = new Headers(observer.headers);
  support.set(SUPPORT_SESSION_HEADER, key('16'));
  expect(engine.subscribe(layoutChannel(zone.warehouseId), support, () => undefined).kind).toBe('denied');
  expect((await second.getWarehouseLayoutDrafts(scope, observer)).drafts).toEqual([]);
  expect(readErrorDetail(await captureError(second.getWarehouseLayoutDrafts(scope, outsider))).code).toBe(ErrorCode.NOT_FOUND);
  expect(readErrorDetail(await captureError(second.getWarehouseLayoutDrafts(scope, { headers: support }))).code)
    .toBe(ErrorCode.MEMBERSHIP_REQUIRED);
  expect(readErrorDetail(await captureError(second.putWarehouseLayoutDraft(request, observer))).code).toBe(ErrorCode.PERMISSION_DENIED);
  expect(readErrorDetail(await captureError(second.putWarehouseLayoutDraft(request, admin))).code)
    .toBe(ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);

  const beforePut = (await storage.load())?.collections.idempotency.size;
  expect(await first.putWarehouseLayoutDraft(request, admin)).toMatchObject({ draftRevision: 1 });
  expect(await first.putWarehouseLayoutDraft(request, admin)).toMatchObject({ draftRevision: 1 });
  expect(readErrorDetail(await captureError(first.putWarehouseLayoutDraft({ ...request, cells: rackCells(6_200) }, admin))).code)
    .toBe(ErrorCode.IDEMPOTENCY_KEY_REUSED);
  expect(await first.putWarehouseLayoutDraft({
    ...request, cells: rackCells(6_200), expectedDraftRevision: 1, idempotencyKey: key('12'),
  }, admin)).toMatchObject({ draftRevision: 2 });
  expect(readErrorDetail(await captureError(first.putWarehouseLayoutDraft(request, admin))).code).toBe(ErrorCode.VERSION_CONFLICT);
  expect((await storage.load())?.collections.idempotency.size).toBe(beforePut);
  expect((await second.getWarehouseLayoutDrafts(scope, observer)).drafts).toMatchObject([
    { baseRevision: 1, footprint: { origin: { xMm: 6_200 } }, rowId: request.rowId, zoneId: zone.zoneId },
  ]);
  expect((await second.getWarehouseTopology(scope, observer)).topology?.revision).toBe(1);
  expect(events).toEqual(['warehouseLayoutDraftsChanged', 'warehouseLayoutDraftsChanged']);

  realTime.advance(30_000);
  const renewal = { ...zone, idempotencyKey: key('13'), layoutSessionId: request.layoutSessionId };
  const { expiresAt } = await first.renewWarehouseLayoutSession(renewal, admin);
  expect((await second.getWarehouseLayoutDrafts(scope, observer)).drafts[0]?.expiresAt).toEqual(expiresAt);
  expect(events).toEqual(Array<string>(3).fill('warehouseLayoutDraftsChanged'));

  await first.releaseWarehouseLayoutSession({ ...renewal, idempotencyKey: key('17') }, admin);
  expect((await second.getWarehouseLayoutDrafts(scope, observer)).drafts).toEqual([]);
  expect(events).toEqual(Array<string>(4).fill('warehouseLayoutDraftsChanged'));
});

it('restores drafts after restarting the leader and expires them against real time while the world is paused', async () => {
  const snapshot = await (await createTestEngine()).storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing initial world');
  }
  const storage = createSpyStorage({ ...snapshot, meta: { ...snapshot.meta, timeScale: 0 } });
  const { first } = await setup(storage);
  const request = await prepareDraft(first);
  await first.putWarehouseLayoutDraft(request, admin);
  const { engine, realTime, second } = await setup(storage);
  const world = engine.getClockSnapshot();
  const scope = { warehouseId: zone.warehouseId };
  const initial = await second.getWarehouseLayoutDrafts(scope, admin);
  expect(initial.drafts).toHaveLength(1);
  expect(initial.serverTime === undefined ? undefined : timestampMs(initial.serverTime)).toBe(realTime.now());

  realTime.advance(119_999);
  expect((await second.getWarehouseLayoutDrafts(scope, admin)).drafts).toHaveLength(1);
  realTime.advance(1);
  expect((await second.getWarehouseLayoutDrafts(scope, admin)).drafts).toHaveLength(0);
  expect(engine.getClockSnapshot()).toEqual(world);
});

it('commits only the published positions, retires the lease atomically and replays the successful save', async () => {
  const { engine, first, second, storage } = await setup();
  const request = await prepareDraft(first);
  const scope = { warehouseId: zone.warehouseId };
  await first.putWarehouseLayoutDraft(request, admin);
  const add = {
    ...scope, cells: request.cells.toReversed(), expectedRevision: 1, idempotencyKey: key('14'), layoutSessionId: request.layoutSessionId,
  };
  const changes: string[] = [];
  for (const channel of [warehouseChannel(zone.warehouseId), layoutChannel(zone.warehouseId)]) {
    engine.subscribe(channel, new Headers(admin.headers), (events) => {
      changes.push(...events.map(event => event.payload.case ?? ''));
    });
  }

  expect(readErrorDetail(await captureError(first.addWarehouseCells({ ...add, cells: rackCells(6_200) }, admin))).code)
    .toBe(ErrorCode.VALIDATION_FAILED);
  storage.failNextCommit();
  expect(readErrorDetail(await captureError(first.addWarehouseCells(add, admin))).code).toBe(ErrorCode.UNAVAILABLE);
  expect((await second.getWarehouseTopology(scope, admin)).topology?.revision).toBe(1);
  expect((await second.getWarehouseLayoutDrafts(scope, admin)).drafts).toHaveLength(1);
  expect(changes).toEqual([]);

  expect(await first.addWarehouseCells(add, admin)).toMatchObject({ revision: 2 });
  expect(changes.toSorted()).toEqual(['warehouseChanged', 'warehouseLayoutDraftsChanged']);
  expect((await second.getWarehouseLayoutDrafts(scope, admin)).drafts).toEqual([]);
  expect((await second.getWarehouseTopology(scope, admin)).topology?.revision).toBe(2);
  expect(await first.addWarehouseCells(add, admin)).toMatchObject({ revision: 2 });
  expect((await second.openWarehouseLayoutSession({ ...zone, idempotencyKey: key('15') }, admin)).layoutSessionId)
    .not.toBe(request.layoutSessionId);
});

it('hides stale drafts for readers and validates revised positions against committed topology', async () => {
  const { first, second } = await setup();
  const request = await prepareDraft(first);
  const scope = { warehouseId: zone.warehouseId };
  await first.putWarehouseLayoutDraft(request, admin);
  await second.addWarehouseCells({ ...scope, cells: [addCell('Z02', 6_000)], expectedRevision: 1, idempotencyKey: key('18') }, admin);

  expect((await second.getWarehouseLayoutDrafts(scope, admin)).drafts).toEqual([]);
  const stale = { ...request, cells: rackCells(6_800), expectedDraftRevision: 1, idempotencyKey: key('19') };
  expect(readErrorDetail(await captureError(first.putWarehouseLayoutDraft(stale, admin))).code).toBe(ErrorCode.VERSION_CONFLICT);
  const overlap = { ...stale, cells: request.cells, expectedRevision: 2 };
  expect(readErrorDetail(await captureError(first.putWarehouseLayoutDraft(overlap, admin))).code).toBe(ErrorCode.VALIDATION_FAILED);
  expect(await first.putWarehouseLayoutDraft({ ...stale, expectedRevision: 2 }, admin)).toMatchObject({ draftRevision: 2 });
  expect((await second.getWarehouseLayoutDrafts(scope, admin)).drafts[0]?.baseRevision).toBe(2);
});

it('preserves the topology and an existing lease when migrating a version 25 snapshot', async () => {
  const { first, storage } = await setup();
  const request = await prepareDraft(first);
  const snapshot = await storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing world with an established layout session');
  }

  const restart = await setup(createSpyStorage({ ...snapshot, schemaVersion: 25 }));
  const scope = { warehouseId: zone.warehouseId };
  expect((await restart.second.getWarehouseLayoutDrafts(scope, admin)).drafts).toEqual([]);
  expect((await restart.second.getWarehouseTopology(scope, admin)).topology)
    .toEqual((await first.getWarehouseTopology(scope, admin)).topology);
  expect(await restart.first.putWarehouseLayoutDraft(request, admin)).toMatchObject({ draftRevision: 1 });
});

it('assigns one editor when two tabs open a zone with the same persona and request key', async () => {
  const { first, second } = await setup();
  const request = { ...zone, idempotencyKey: key('01') };
  const [owner, rejected] = await Promise.allSettled([
    first.openWarehouseLayoutSession(request, admin),
    second.openWarehouseLayoutSession(request, admin),
  ]);
  expect(owner.status).toBe('fulfilled');
  expect(rejected).toMatchObject({ status: 'rejected' });
  const active = await first.openWarehouseLayoutSession(request, admin);
  expect(readErrorDetail(await captureError(second.openWarehouseLayoutSession(request, admin)))).toMatchObject({
    code: ErrorCode.WAREHOUSE_LAYOUT_BUSY,
    params: { case: 'warehouseLayoutBusy', value: { expiresAt: active.expiresAt, zoneId: zone.zoneId } },
  });
  const copied = { ...zone, idempotencyKey: key('02'), layoutSessionId: active.layoutSessionId };
  expect(readErrorDetail(await captureError(second.renewWarehouseLayoutSession(copied, admin))).code)
    .toBe(ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);
  await second.releaseWarehouseLayoutSession(copied, admin);
  await first.renewWarehouseLayoutSession(copied, admin);
  await first.releaseWarehouseLayoutSession(copied, admin);
  const successor = await second.openWarehouseLayoutSession(request, admin);
  expect(successor.layoutSessionId).not.toBe(active.layoutSessionId);
  expect(await first.openWarehouseLayoutSession(request, admin)).toEqual(active);
  await first.releaseWarehouseLayoutSession(copied, admin);
  expect((await second.renewWarehouseLayoutSession({ ...copied, layoutSessionId: successor.layoutSessionId }, admin)).expiresAt)
    .toBeDefined();
});

it('checks warehouse rights and zone membership before opening a session', async () => {
  const { first } = await setup();
  const request = { ...zone, idempotencyKey: key('01') };
  const storekeeper = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
  const supplier = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
  expect(readErrorDetail(await captureError(first.openWarehouseLayoutSession(request, storekeeper))).code)
    .toBe(ErrorCode.PERMISSION_DENIED);
  expect(readErrorDetail(await captureError(first.openWarehouseLayoutSession(request, supplier)))).toMatchObject({
    code: ErrorCode.NOT_FOUND, params: { case: 'notFound', value: { entity: EntityKind.WAREHOUSE } },
  });
  expect(readErrorDetail(await captureError(first.openWarehouseLayoutSession({ ...request, zoneId: key('09') }, admin)))).toMatchObject({
    code: ErrorCode.NOT_FOUND, params: { case: 'notFound', value: { entity: EntityKind.WAREHOUSE_STORAGE_ZONE } },
  });
});

it('uses real time for expiry while the world is paused and renews at most once per key', async () => {
  const snapshot = await (await createTestEngine()).storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing initial world');
  }
  const { engine, first, realTime, second } = await setup(createSpyStorage({ ...snapshot, meta: { ...snapshot.meta, timeScale: 0 } }));
  const world = engine.getClockSnapshot();
  const request = { ...zone, idempotencyKey: key('01') };
  const active = await first.openWarehouseLayoutSession(request, admin);
  expect(active.expiresAt === undefined ? undefined : timestampMs(active.expiresAt)).toBe(realTime.now() + 120_000);
  realTime.advance(90_000);
  const renewal = { ...zone, idempotencyKey: key('02'), layoutSessionId: active.layoutSessionId };
  const renewed = await first.renewWarehouseLayoutSession(renewal, admin);
  realTime.advance(119_999);
  expect(await first.renewWarehouseLayoutSession(renewal, admin)).toEqual(renewed);
  expect(readErrorDetail(await captureError(second.openWarehouseLayoutSession(request, admin))).code)
    .toBe(ErrorCode.WAREHOUSE_LAYOUT_BUSY);
  realTime.advance(1);
  const successor = await second.openWarehouseLayoutSession(request, admin);
  expect(successor.layoutSessionId).not.toBe(active.layoutSessionId);
  expect(readErrorDetail(await captureError(first.renewWarehouseLayoutSession({ ...renewal, idempotencyKey: key('03') }, admin))).code)
    .toBe(ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);
  expect(engine.getClockSnapshot()).toEqual(world);
});

it('binds an active session to the original persona even when another persona has layout rights in the same tab', async () => {
  const snapshot = await (await createTestEngine()).storage.load();
  const stored = snapshot?.collections.memberships.get(SeedMembershipId.STOREKEEPER_1);
  if (snapshot === undefined || stored === undefined) {
    throw new Error('Missing warehouse member');
  }
  const membership = TABLE_DEFINITIONS.memberships.decode(stored);
  membership.roleAssignments.push(create(RoleAssignmentSchema, { roleId: SeedRoleId.DIRECTOR_CUSTOMER_1 }));
  const memberships = new Map(snapshot.collections.memberships);
  memberships.set(membership.id, TABLE_DEFINITIONS.memberships.encode(membership));
  const { first } = await setup(createSpyStorage({ ...snapshot, collections: { ...snapshot.collections, memberships } }));
  const alternate = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
  const request = { ...zone, idempotencyKey: key('01') };
  const { layoutSessionId } = await first.openWarehouseLayoutSession(request, admin);
  expect(readErrorDetail(await captureError(first.openWarehouseLayoutSession(request, alternate))).code)
    .toBe(ErrorCode.WAREHOUSE_LAYOUT_BUSY);
  const renew = { ...zone, idempotencyKey: key('02'), layoutSessionId };
  expect(readErrorDetail(await captureError(first.renewWarehouseLayoutSession(renew, alternate))).code)
    .toBe(ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);
  expect((await first.renewWarehouseLayoutSession(renew, admin)).expiresAt).toBeDefined();
});

it('protects leased zones on direct writes and retains the revision and geometry checks', async () => {
  const { first, second } = await setup();
  const active = await first.openWarehouseLayoutSession({ ...zone, idempotencyKey: key('01') }, admin);
  const { warehouseId } = zone;
  const addition = { cells: [addCell(' Z01 ', 6_000)], expectedRevision: 1, idempotencyKey: key('02'), warehouseId };
  expect(readErrorDetail(await captureError(second.addWarehouseCells(addition, admin))).code).toBe(ErrorCode.WAREHOUSE_LAYOUT_BUSY);
  const ownerWrite = { ...addition, layoutSessionId: active.layoutSessionId };
  expect(readErrorDetail(await captureError(second.addWarehouseCells(ownerWrite, admin))).code)
    .toBe(ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);
  expect(readErrorDetail(await captureError(first.addWarehouseCells({
    ...ownerWrite, cells: [...addition.cells, addCell('Z02', 7_000)],
  }, admin))).code).toBe(ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);
  expect(await second.addWarehouseCells({ ...addition, cells: [addCell('Z02', 7_000)] }, admin)).toMatchObject({ revision: 2 });
  const { topology } = await second.getWarehouseTopology({ warehouseId }, admin);
  const otherZoneId = topology?.storageZones.find(entry => entry.code === 'Z02')?.id;
  if (otherZoneId === undefined) {
    throw new Error('Missing second zone');
  }
  await second.openWarehouseLayoutSession({ ...zone, idempotencyKey: key('01'), zoneId: otherZoneId }, admin);
  expect(readErrorDetail(await captureError(first.addWarehouseCells(ownerWrite, admin))).code).toBe(ErrorCode.VERSION_CONFLICT);
  expect(readErrorDetail(await captureError(first.addWarehouseCells({
    ...ownerWrite, cells: [addCell('Z01', 7_000)], expectedRevision: 2,
  }, admin))).code).toBe(ErrorCode.VALIDATION_FAILED);
  const saved = { ...ownerWrite, expectedRevision: 2 };
  expect(await first.addWarehouseCells(saved, admin)).toMatchObject({ revision: 3 });
  await first.releaseWarehouseLayoutSession({ ...zone, idempotencyKey: key('04'), layoutSessionId: active.layoutSessionId }, admin);
  expect(await first.addWarehouseCells(saved, admin)).toMatchObject({ revision: 3 });
  expect(readErrorDetail(await captureError(second.addWarehouseCells(saved, admin))).code)
    .toBe(ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);
});

it('rolls back failed session storage writes and invalidates tokens on world reset', async () => {
  const { engine, first, storage } = await setup();
  const request = { ...zone, idempotencyKey: key('01') };
  storage.failNextCommit();
  expect(readErrorDetail(await captureError(first.openWarehouseLayoutSession(request, admin))).code).toBe(ErrorCode.UNAVAILABLE);
  const active = await first.openWarehouseLayoutSession(request, admin);
  const renew = { ...zone, idempotencyKey: key('02'), layoutSessionId: active.layoutSessionId };
  storage.failNextCommit();
  expect(readErrorDetail(await captureError(first.renewWarehouseLayoutSession(renew, admin))).code).toBe(ErrorCode.UNAVAILABLE);
  expect((await storage.load())?.collections.warehouseLayoutSessions.size).toBe(1);
  await engine.reset('new-epoch');
  expect((await storage.load())?.collections.warehouseLayoutSessions.size).toBe(0);
  const next = await first.openWarehouseLayoutSession(request, admin);
  expect(next.layoutSessionId).not.toBe(active.layoutSessionId);
  expect(readErrorDetail(await captureError(first.renewWarehouseLayoutSession(renew, admin))).code)
    .toBe(ErrorCode.WAREHOUSE_LAYOUT_SESSION_INVALID);
});
