import type { MessageInitShape } from '@bufbuild/protobuf';
import type { Client } from '@connectrpc/connect';
import type { WarehouseCellInputSchema } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import { timestampMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { RoleAssignmentSchema } from '@skladburg/contracts/access/v1/access';
import { EntityKind } from '@skladburg/contracts/common/v1/entity';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { WarehouseLayoutSessionService } from '@skladburg/contracts/wms/v1/layout_session';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
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
