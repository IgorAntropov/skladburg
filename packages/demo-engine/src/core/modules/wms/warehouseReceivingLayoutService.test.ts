import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';
import {
  ErrorCode,
  WarehouseReceivingLayoutBlockedReason,
} from '@skladburg/contracts/common/v1/error';
import { WarehouseCapability } from '@skladburg/contracts/organization/v1/organization';
import {
  PickingTaskSchema,
  PickingTaskStatus,
} from '@skladburg/contracts/wms/v1/picking';
import {
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  WarehouseReceivingService,
  YardAdmissionStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import { WarehouseReceivingLayoutService } from '@skladburg/contracts/wms/v1/receiving_layout';
import { StockBalanceSchema } from '@skladburg/contracts/wms/v1/stock';
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
import {
  expect,
  it,
} from 'vitest';

import type { SpyStorageValue } from '../../engine/testing/engineHarness';

import {
  createEngineTransport,
  createTestEngine,
} from '../../engine/testing/engineHarness';
import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { TABLE_DEFINITIONS } from '../../state/index';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { buildSsccKey } from './stockRecords';

const admin = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2;
const key = (suffix: string): string => `f0000000-0000-4000-8000-0000000000${suffix}`;
const footprint = { depthMm: 2_000, origin: { xMm: 1_000, zMm: 1_000 }, widthMm: 7_000 };
const request = {
  docks: [{ xMm: 2_000 }, { xMm: 5_000 }],
  expectedRevision: 1,
  idempotencyKey: key('71'),
  receivingFootprint: footprint,
  warehouseId,
};

it('configures a zone and two docks atomically and replays the same revision after restarting', async () => {
  const { engine, storage } = await createTestEngine();
  const transport = createEngineTransport(engine, true);
  const topology = createClient(WarehouseTopologyService, transport);
  const layout = createClient(WarehouseReceivingLayoutService, transport);
  await topology.initializeWarehouseLayout({
    expectedRevision: 0,
    idempotencyKey: key('70'),
    warehouseDepthMm: 9_000,
    warehouseId,
    warehouseWidthMm: 12_000,
    zoneBounds: { depthMm: 4_000, origin: { xMm: 1_000, zMm: 4_500 }, widthMm: 6_000 },
  }, admin);
  const before = (await topology.getWarehouseTopology({ warehouseId }, admin)).topology;
  await expect(layout.configureWarehouseReceivingLayout(request, admin)).resolves.toMatchObject({ revision: 2 });
  const after = (await topology.getWarehouseTopology({ warehouseId }, admin)).topology;
  expect(after?.storageZones).toEqual(before?.storageZones);
  expect(after?.receivingArea).toMatchObject({
    additionalUnloadingPoints: [{ code: 'D02', position: { xMm: 5_000, zMm: 0 } }],
    code: 'PR01',
    footprint,
    unloadingPoint: { capabilities: [WarehouseCapability.RAMP], code: 'D01', position: { xMm: 2_000, zMm: 0 } },
  });
  const stale = await captureError(layout.configureWarehouseReceivingLayout({ ...request, idempotencyKey: key('72') }, admin));
  expect(readErrorDetail(stale).code).toBe(ErrorCode.VERSION_CONFLICT);

  const restarted = createEngineTransport((await createTestEngine({ storage })).engine, true);
  const saved = createClient(WarehouseReceivingLayoutService, restarted);
  await expect(saved.configureWarehouseReceivingLayout(request, admin)).resolves.toMatchObject({ revision: 2 });
  expect((await createClient(WarehouseTopologyService, restarted).getWarehouseTopology({ warehouseId }, admin)).topology).toEqual(after);
});

it('checks warehouse permissions and requires an initialized topology', async () => {
  const { engine } = await createTestEngine();
  const client = createClient(WarehouseReceivingLayoutService, createEngineTransport(engine, true));
  const storekeeper = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
  const supplier = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
  const configure = client.configureWarehouseReceivingLayout;

  expect(readErrorDetail(await captureError(configure(request, storekeeper))).code).toBe(ErrorCode.PERMISSION_DENIED);
  expect(readErrorDetail(await captureError(configure(request, supplier))).code).toBe(ErrorCode.NOT_FOUND);
  const error = await captureError(configure({ ...request, expectedRevision: 0 }, admin));
  expect(readErrorDetail(error)).toMatchObject({
    code: ErrorCode.VALIDATION_FAILED,
    params: { value: { violations: [{ fieldPath: 'warehouse_id', ruleId: 'warehouse.layout_not_initialized' }] } },
  });
});

const legacyWarehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1;
const tenantId = SeedOrganizationId.CUSTOMER_1;
const legacyAreaId = '8f000002-0000-4000-8000-000000000010';
const legacyDockId = '8f000002-0000-4000-8000-000000000011';
const taskId = key('80');
const stockId = key('81');
const sscc = '000000000000000017';
const legacyRequest = {
  docks: [{ unloadingPointId: legacyDockId, xMm: 1_000 }],
  expectedRevision: 1,
  idempotencyKey: key('82'),
  receivingFootprint: { depthMm: 3_000, origin: { xMm: 1_000, zMm: 1_000 }, widthMm: 2_000 },
  warehouseId: legacyWarehouseId,
};

const seedActivity = async (status: ReceivingTaskStatus, dockId: string | undefined, hasStagedStock = false): Promise<SpyStorageValue> => {
  const { storage } = await createTestEngine();
  const snapshot = await storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing seed snapshot');
  }
  const task = create(ReceivingTaskSchema, {
    dealId: taskId,
    expectedUnits: [{ id: key('83') }],
    id: taskId,
    orderLines: [{ dealLineId: key('84') }],
    receivingAreaId: legacyAreaId,
    status,
    unloadingPointId: dockId,
    version: 1,
    warehouseId: legacyWarehouseId,
    yardAdmissionStatus: dockId === undefined ? YardAdmissionStatus.WAITING_DOCK : YardAdmissionStatus.ADMITTED,
  });
  const balance = create(StockBalanceSchema, {
    handlingUnit: { id: stockId, sscc, tenantId, warehouseId: legacyWarehouseId },
    lines: [{ quantityBase: 1n }],
    receivingAreaId: legacyAreaId,
  });
  await storage.commit({
    deletes: {},
    meta: snapshot.meta,
    puts: {
      warehouseInbound: new Map([[taskId, TABLE_DEFINITIONS.warehouseInbound.encode({
        bytes: toBinary(ReceivingTaskSchema, task), id: taskId, lookupKey: tenantId, scopeId: legacyWarehouseId,
      })]]),
      ...(hasStagedStock
        ? {
            stockBalances: new Map([[stockId, TABLE_DEFINITIONS.stockBalances.encode({
              bytes: toBinary(StockBalanceSchema, balance),
              id: stockId,
              lookupKey: buildSsccKey(tenantId, sscc),
              scopeId: legacyWarehouseId,
            })]]),
          }
        : {}),
    },
  });

  return storage;
};

const addition = {
  ...legacyRequest,
  docks: [...legacyRequest.docks, { xMm: 7_200 }],
  receivingFootprint: { depthMm: 2_000, origin: { xMm: 1_000, zMm: 2_100 }, widthMm: 7_500 },
};

it('protects the assigned dock before the first scan and the shared yard during unloading', async () => {
  const storage = await seedActivity(ReceivingTaskStatus.OPEN, legacyDockId);
  const { engine } = await createTestEngine({ storage });
  const transport = createEngineTransport(engine, true);
  const configure = createClient(WarehouseReceivingLayoutService, transport).configureWarehouseReceivingLayout;
  await expect(configure(legacyRequest, admin)).resolves.toMatchObject({ revision: 1 });
  const move = { ...legacyRequest, docks: [{ unloadingPointId: legacyDockId, xMm: 1_500 }], idempotencyKey: key('85') };
  const detail = readErrorDetail(await captureError(configure(move, admin)));
  expect(detail).toMatchObject({
    code: ErrorCode.WAREHOUSE_RECEIVING_LAYOUT_BLOCKED,
    params: { value: { reason: WarehouseReceivingLayoutBlockedReason.DOCK_OCCUPIED, unloadingPointId: legacyDockId } },
  });
  const addDetail = readErrorDetail(await captureError(configure({ ...addition, idempotencyKey: key('86') }, admin)));
  expect(addDetail).toMatchObject({ params: { value: { reason: WarehouseReceivingLayoutBlockedReason.YARD_ACTIVE } } });
  const topology = createClient(WarehouseTopologyService, transport);
  expect((await topology.getWarehouseTopology({ warehouseId: legacyWarehouseId }, admin)).topology?.revision).toBe(1);
  const tasks = await createClient(WarehouseReceivingService, transport).listReceivingTasks({ warehouseId: legacyWarehouseId }, admin);
  expect(tasks.tasks).toMatchObject([{ id: taskId, status: ReceivingTaskStatus.OPEN, unloadingPointId: legacyDockId, version: 1 }]);
});

it('adds a dock for a waiting truck and keeps the inherited capabilities of the original dock', async () => {
  const storage = await seedActivity(ReceivingTaskStatus.OPEN, undefined);
  const { engine } = await createTestEngine({ storage });
  const transport = createEngineTransport(engine, true);
  const configure = createClient(WarehouseReceivingLayoutService, transport).configureWarehouseReceivingLayout;
  await expect(configure(addition, admin)).resolves.toMatchObject({ revision: 2 });
  const topologyClient = createClient(WarehouseTopologyService, transport);
  const { topology } = await topologyClient.getWarehouseTopology({ warehouseId: legacyWarehouseId }, admin);
  expect(topology?.receivingArea?.unloadingPoint).toMatchObject({
    capabilities: [WarehouseCapability.RAMP, WarehouseCapability.COLD], id: legacyDockId,
  });
  const added = topology?.receivingArea?.additionalUnloadingPoints[0];
  expect(added?.code).toBe('D02');
  const tasks = await createClient(WarehouseReceivingService, transport).listReceivingTasks({ warehouseId: legacyWarehouseId }, admin);
  expect(tasks.tasks).toMatchObject([{ id: taskId, unloadingPointId: added?.id, version: 2 }]);
});

it('allows a capability change on the free dock and leaves the active assignment intact', async () => {
  const storage = await seedActivity(ReceivingTaskStatus.OPEN, undefined);
  const transport = createEngineTransport((await createTestEngine({ storage })).engine, true);
  const configure = createClient(WarehouseReceivingLayoutService, transport).configureWarehouseReceivingLayout;
  await configure(addition, admin);
  const topologyClient = createClient(WarehouseTopologyService, transport);
  const { topology } = await topologyClient.getWarehouseTopology({ warehouseId: legacyWarehouseId }, admin);
  const added = topology?.receivingArea?.additionalUnloadingPoints[0];
  if (added === undefined) {
    throw new Error('Missing additional dock');
  }
  await expect(configure({
    ...addition,
    docks: [
      { capabilities: [WarehouseCapability.RAMP], unloadingPointId: legacyDockId, xMm: 1_000 },
      { unloadingPointId: added.id, xMm: 7_200 },
    ],
    expectedRevision: 2,
    idempotencyKey: key('88'),
  }, admin)).resolves.toMatchObject({ revision: 3 });
  const receiving = createClient(WarehouseReceivingService, transport);
  expect((await receiving.listReceivingTasks({ warehouseId: legacyWarehouseId }, admin)).tasks)
    .toMatchObject([{ id: taskId, unloadingPointId: added.id, version: 2 }]);
});

it('protects the primary dock while outbound picking waits for loading', async () => {
  const { storage } = await createTestEngine();
  const snapshot = await storage.load();
  if (snapshot === undefined) {
    throw new Error('Missing seed snapshot');
  }
  const task = create(PickingTaskSchema, {
    dealId: taskId,
    id: taskId,
    status: PickingTaskStatus.PICKED,
    units: [{ handlingUnit: { tenantId, warehouseId: legacyWarehouseId } }],
    warehouseId: legacyWarehouseId,
  });
  await storage.commit({
    deletes: {},
    meta: snapshot.meta,
    puts: {
      warehouseOutbound: new Map([[taskId, TABLE_DEFINITIONS.warehouseOutbound.encode({
        bytes: toBinary(PickingTaskSchema, task), id: taskId, lookupKey: tenantId, scopeId: legacyWarehouseId,
      })]]),
    },
  });
  const transport = createEngineTransport((await createTestEngine({ storage })).engine, true);
  const configure = createClient(WarehouseReceivingLayoutService, transport).configureWarehouseReceivingLayout;
  const move = { ...legacyRequest, docks: [{ unloadingPointId: legacyDockId, xMm: 1_500 }] };
  expect(readErrorDetail(await captureError(configure(move, admin)))).toMatchObject({
    code: ErrorCode.WAREHOUSE_RECEIVING_LAYOUT_BLOCKED,
    params: { value: { reason: WarehouseReceivingLayoutBlockedReason.DOCK_OCCUPIED, unloadingPointId: legacyDockId } },
  });
});

it('keeps the footprint fixed while reconciled cargo is staged and accepts the same edit after the area is clear', async () => {
  const command = { ...legacyRequest, receivingFootprint: { ...legacyRequest.receivingFootprint, widthMm: 2_500 } };
  const storage = await seedActivity(ReceivingTaskStatus.RECONCILED, legacyDockId, true);
  const warehouseRequest = { warehouseId: legacyWarehouseId };
  const transport = createEngineTransport((await createTestEngine({ storage })).engine, true);
  const detail = readErrorDetail(await captureError(createClient(WarehouseReceivingLayoutService, transport)
    .configureWarehouseReceivingLayout(command, admin)));
  expect(detail).toMatchObject({
    code: ErrorCode.WAREHOUSE_RECEIVING_LAYOUT_BLOCKED,
    params: { value: { reason: WarehouseReceivingLayoutBlockedReason.RECEIVING_AREA_OCCUPIED } },
  });
  const topology = createClient(WarehouseTopologyService, transport);
  expect((await topology.getWarehouseTopology(warehouseRequest, admin)).topology?.revision).toBe(1);

  const cleared = await seedActivity(ReceivingTaskStatus.RECONCILED, legacyDockId);
  const reopened = createEngineTransport((await createTestEngine({ storage: cleared })).engine, true);
  await expect(createClient(WarehouseReceivingLayoutService, reopened).configureWarehouseReceivingLayout(command, admin))
    .resolves.toMatchObject({ revision: 2 });
});
