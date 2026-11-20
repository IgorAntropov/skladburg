import type { MessageInitShape } from '@bufbuild/protobuf';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';
import type { WarehouseStaffAreaPresence } from '@skladburg/contracts/wms/v1/warehouse_staff_presence';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { SUPPORT_SESSION_HEADER } from '@skladburg/contracts/runtime';
import {
  SupportAccessSection,
  SupportAccessStatus,
  SupportAuditAction,
  SupportAuditOutcome,
} from '@skladburg/contracts/support/v1/support_access';
import {
  ReceivedHandlingUnitSchema,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  WarehouseStaffAreaKind,
  WarehouseStaffPresenceService,
} from '@skladburg/contracts/wms/v1/warehouse_staff_presence';
import {
  expect,
  it,
} from 'vitest';

import {
  createEngineTransport,
  createSpyStorage,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { createSeedWarehouseTopology } from '../../seed/seedWarehouseTopologies';
import { TABLE_DEFINITIONS } from '../../state/index';
import { createTestSupportAccessSession } from '../../state/testRecords';
import { nextUuid } from '../catalog/testing/catalogFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import { saveInboundTask } from './inboundRecords';
import { encodeWarehouseTopology } from './warehouseTopologyCodec';

const TENANT = SeedOrganizationId.CUSTOMER_1;
const WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1;
const OTHER_WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2;
const RECEIVING = '8f000002-0000-4000-8000-000000000010';
const STORAGE = '8f000002-0000-4000-8000-000000000001';
const CELL = '8f000002-0000-4000-8000-000000000006';
const director = callAs(SeedUserId.ADMIN_1, TENANT);

const counts = (receiving: number, storage: number): Omit<WarehouseStaffAreaPresence, '$typeName' | '$unknown'>[] => [
  { areaCode: 'PR01', areaId: RECEIVING, kind: WarehouseStaffAreaKind.RECEIVING, observedStaffCount: receiving },
  { areaCode: 'Z01', areaId: STORAGE, kind: WarehouseStaffAreaKind.STORAGE, observedStaffCount: storage },
];

const createTask = (input: MessageInitShape<typeof ReceivingTaskSchema>): ReceivingTask => {
  const id = nextUuid();
  return create(ReceivingTaskSchema, {
    assigneeUserId: SeedUserId.STOREKEEPER_1,
    dealId: id,
    expectedUnits: [{ id: nextUuid() }],
    id,
    orderLines: [{ dealLineId: nextUuid() }],
    receivingAreaId: RECEIVING,
    status: ReceivingTaskStatus.IN_PROGRESS,
    version: 2,
    warehouseId: WAREHOUSE,
    ...input,
  });
};

it('limits the aggregate to staff_view and the granted warehouse', async () => {
  const harness = createModuleHarness();
  const viewer = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['staff_view'], warehouseIds: [WAREHOUSE],
  });
  const { runtime } = harness;
  await runtime.command((transaction) => {
    const topology = createSeedWarehouseTopology({ prefix: '8f000002', tenantId: TENANT, warehouseId: WAREHOUSE });
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
  });
  const client = createClient(WarehouseStaffPresenceService, harness.transport);
  const scoped = callAs(viewer, TENANT);
  expect((await client.getWarehouseStaffPresence({ warehouseId: WAREHOUSE }, scoped)).areas).toMatchObject(counts(0, 0));
  expect((await client.getWarehouseStaffPresence({ warehouseId: OTHER_WAREHOUSE }, director)).areas).toEqual([]);

  const denied = [
    { caller: scoped, code: ErrorCode.PERMISSION_DENIED, warehouseId: OTHER_WAREHOUSE },
    { caller: callAs(SeedUserId.STOREKEEPER_1, TENANT), code: ErrorCode.PERMISSION_DENIED, warehouseId: WAREHOUSE },
    { caller: callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1), code: ErrorCode.NOT_FOUND, warehouseId: WAREHOUSE },
    { caller: callAs(SeedUserId.ADMIN_4, SeedOrganizationId.CARRIER_1), code: ErrorCode.PERMISSION_DENIED, warehouseId: WAREHOUSE },
    { caller: director, code: ErrorCode.VALIDATION_FAILED, warehouseId: '' },
  ];
  for (const { caller, code, warehouseId } of denied) {
    expect(readErrorDetail(await captureError(client.getWarehouseStaffPresence({ warehouseId }, caller))).code).toBe(code);
  }
});

it('counts each member at the latest unambiguous area across active receiving tasks', async () => {
  const { runtime, transport } = createModuleHarness();
  const client = createClient(WarehouseStaffPresenceService, transport);
  const read = async (): Promise<WarehouseStaffAreaPresence[]> =>
    (await client.getWarehouseStaffPresence({ warehouseId: WAREHOUSE }, director)).areas;
  const receivedAt = timestampFromMs(1_000);
  const putAwayAt = timestampFromMs(2_000);
  const receipt = createTask({ receivedUnits: [{ receivedAt }] });
  const placement = createTask({ receivedUnits: [{ putAwayAt, putAwayCellId: CELL, receivedAt }] });
  const latestReceipt = createTask({ receivedUnits: [{ receivedAt: putAwayAt }] });
  const save = async (task: ReceivingTask, tenantId: string = TENANT): Promise<void> =>
    runtime.command((transaction) => { saveInboundTask(transaction, runtime, task, tenantId); });

  await runtime.command((transaction) => {
    const topology = createSeedWarehouseTopology({ prefix: '8f000002', tenantId: TENANT, warehouseId: WAREHOUSE });
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
  });
  await save(receipt);
  await save(createTask({ receivedUnits: [{ receivedAt }, { receivedAt }] }));
  await save(createTask({ assigneeUserId: SeedUserId.ADMIN_2, receivedUnits: [{ receivedAt }] }));
  await save(createTask({ assigneeUserId: SeedUserId.ADMIN_1, receivedUnits: [{ receivedAt }] }), SeedOrganizationId.SUPPLIER_1);
  await save(createTask({ assigneeUserId: SeedUserId.ADMIN_1, receivedUnits: [{ receivedAt }], warehouseId: OTHER_WAREHOUSE }));
  await expect(read()).resolves.toMatchObject(counts(1, 0));

  await save(placement);
  await expect(read()).resolves.toMatchObject(counts(0, 1));
  await save(latestReceipt);
  await expect(read()).resolves.toMatchObject(counts(0, 0));
  const later = timestampFromMs(3_000);
  await save({ ...latestReceipt, receivedUnits: [create(ReceivedHandlingUnitSchema, { receivedAt: later })] });
  await expect(read()).resolves.toMatchObject(counts(1, 0));

  const unknownPlacement = create(ReceivedHandlingUnitSchema, { putAwayAt: later, putAwayCellId: nextUuid(), receivedAt });
  await save({ ...placement, receivedUnits: [unknownPlacement] });
  await expect(read()).resolves.toMatchObject(counts(0, 0));
  await save({ ...placement, status: ReceivingTaskStatus.READY_FOR_RECONCILIATION });
  await expect(read()).resolves.toMatchObject(counts(1, 0));
});

it('returns the scheduled roster and matches plans only to their original warehouse areas', async () => {
  const { runtime, transport } = createModuleHarness();
  const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
  const topology = createSeedWarehouseTopology({ prefix: '8f000004', tenantId: TENANT, warehouseId });
  const [zone] = topology.storageZones;
  if (zone === undefined) {
    throw new Error('Missing storage zone');
  }
  topology.storageZones.push({ ...zone, code: 'Z02', id: nextUuid(), rows: [] });
  await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(topology));
  });
  const client = createClient(WarehouseStaffPresenceService, transport);
  const read = (): ReturnType<typeof client.getWarehouseStaffPresence> => client.getWarehouseStaffPresence({ warehouseId }, director);
  const morning = await read();
  expect(morning.shift).toMatchObject({ offSiteCount: 0, onBreakCount: 0, onShiftCount: 3 });
  expect(morning.areas.map(area => [area.areaCode, area.plannedStaffCount, area.observedStaffCount]))
    .toEqual([['PR01', 2, 0], ['Z01', 1, 0], ['Z02', undefined, 0]]);

  runtime.getWorldTimeMs = () => Date.UTC(2026, 9, 12, 9);
  const midday = await read();
  expect(midday.shift).toMatchObject({ offSiteCount: 0, onBreakCount: 2, onShiftCount: 1 });
  expect(midday.areas.map(area => area.plannedStaffCount)).toEqual([0, 1, undefined]);
  expect((await client.getWarehouseStaffPresence({ warehouseId: OTHER_WAREHOUSE }, director)).shift).toBeUndefined();
});

it('audits warehouse support reads through the engine router', async () => {
  const { storage } = await createTestEngine();
  const snapshot = await storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing seed snapshot');
  }

  const staffId = SeedUserId.OPERATOR_SUPPORT_ENGINEER;
  const session = createTestSupportAccessSession(nextUuid(), TENANT, staffId, SupportAccessStatus.ACTIVE, {
    expiresAt: timestampFromMs(snapshot.meta.worldTimeMs + 60_000), section: SupportAccessSection.WAREHOUSES,
  });
  const withSession = createSpyStorage({
    ...snapshot,
    collections: {
      ...snapshot.collections,
      supportAccessSessions: new Map([[session.id, TABLE_DEFINITIONS.supportAccessSessions.encode(session)]]),
    },
  });
  const { engine } = await createTestEngine({ storage: withSession });
  const client = createClient(WarehouseStaffPresenceService, createEngineTransport(engine, true));
  const headers = new Headers(callAs(staffId, TENANT).headers);
  headers.set(SUPPORT_SESSION_HEADER, session.id);

  expect((await client.getWarehouseStaffPresence({ warehouseId: WAREHOUSE }, { headers })).areas).toMatchObject(counts(0, 0));
  const persisted = await withSession.load();
  const audit = [...(persisted?.collections.supportAuditEntries.values() ?? [])].map(TABLE_DEFINITIONS.supportAuditEntries.decode);
  expect(audit).toEqual([expect.objectContaining({
    action: SupportAuditAction.READ,
    method: 'wms.v1.WarehouseStaffPresenceService/GetWarehouseStaffPresence',
    outcome: SupportAuditOutcome.ALLOWED,
    sessionId: session.id,
  })]);
});
