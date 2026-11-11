import type { Event } from '@skladburg/contracts/event/v1/event';
import type { AddWarehouseCellsRequest } from '@skladburg/contracts/wms/v1/topology';

import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  ConnectError,
  createClient,
} from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  WarehouseChange,
  WarehouseChangedSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  organizationChannel,
  SUPPORT_SESSION_HEADER,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  SupportAccessSection,
  SupportAccessStatus,
  SupportAuditAction,
  SupportAuditOutcome,
} from '@skladburg/contracts/support/v1/support_access';
import {
  AddWarehouseCellsRequestSchema,
  WarehouseTopologyService,
} from '@skladburg/contracts/wms/v1/topology';
import {
  describe,
  expect,
  it,
} from 'vitest';

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
import { createTestSupportAccessSession } from '../../state/testRecords';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';

describe('GetWarehouseTopology', () => {
  it('returns stable addresses to a scoped member and uses the same service across persona changes', async () => {
    const { engine } = await createTestEngine();
    const client = createClient(WarehouseTopologyService, createEngineTransport(engine, true));
    const customerRequest = { warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1 };
    const customer = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);

    const result = await client.getWarehouseTopology(customerRequest, customer);
    expect(result.topology).toMatchObject({
      receivingArea: { unloadingPoint: { position: { xMm: 1_000 } } },
      revision: 1,
      tenantId: SeedOrganizationId.CUSTOMER_1,
      warehouseId: customerRequest.warehouseId,
    });
    const cells = result.topology?.storageZones.flatMap(zone => zone.rows
      .flatMap(row => row.racks.flatMap(rack => rack.tiers.flatMap(tier => tier.cells)))) ?? [];
    expect(cells.map(cell => cell.code)).toEqual([
      'Z01-R01-S01-Y01-C01',
      'Z01-R01-S01-Y01-C02',
      'Z01-R01-S01-Y02-C01',
      'Z01-R01-S01-Y02-C02',
    ]);
    expect(new Set(cells.map(cell => cell.id)).size).toBe(4);

    const supplier = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
    const supplierResult = await client.getWarehouseTopology({ warehouseId: SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1 }, supplier);
    expect(supplierResult.topology?.tenantId).toBe(SeedOrganizationId.SUPPLIER_1);
    const denied = await captureError(client.getWarehouseTopology(customerRequest, supplier));
    expect(readErrorDetail(denied).code).toBe(ErrorCode.NOT_FOUND);
    expect(await client.getWarehouseTopology(customerRequest, customer)).toEqual(result);
  });

  it('distinguishes a warehouse with no plan from requests outside the caller’s scope', async () => {
    const { engine } = await createTestEngine();
    const client = createClient(WarehouseTopologyService, createEngineTransport(engine, true));
    const request = { warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2 };

    const admin = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);
    expect((await client.getWarehouseTopology(request, admin)).topology).toBeUndefined();

    const storekeeper = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
    const denied = await captureError(client.getWarehouseTopology(request, storekeeper));
    expect(readErrorDetail(denied).code).toBe(ErrorCode.PERMISSION_DENIED);
    const invalid = await captureError(client.getWarehouseTopology({ warehouseId: '' }, admin));
    expect(readErrorDetail(invalid).code).toBe(ErrorCode.VALIDATION_FAILED);
    const missing = await captureError(client.getWarehouseTopology({ warehouseId: 'f0000000-0000-4000-8000-000000000001' }, admin));
    expect(readErrorDetail(missing).code).toBe(ErrorCode.NOT_FOUND);
  });
  it('records an audited read when an active warehouse support session is used', async () => {
    const { storage } = await createTestEngine();
    const snapshot = await storage.load();

    if (snapshot === undefined) {
      throw new Error('Missing seed snapshot');
    }

    const organizationId = SeedOrganizationId.CUSTOMER_1;
    const staffId = SeedUserId.OPERATOR_SUPPORT_ENGINEER;
    const session = createTestSupportAccessSession(
      'f0000000-0000-4000-8000-000000000002',
      organizationId,
      staffId,
      SupportAccessStatus.ACTIVE,
      { expiresAt: timestampFromMs(snapshot.meta.worldTimeMs + 60_000), section: SupportAccessSection.WAREHOUSES },
    );
    await storage.commit({
      deletes: {},
      meta: snapshot.meta,
      puts: { supportAccessSessions: new Map([[session.id, TABLE_DEFINITIONS.supportAccessSessions.encode(session)]]) },
    });
    const { engine } = await createTestEngine({ storage });
    const client = createClient(WarehouseTopologyService, createEngineTransport(engine, true));
    const headers = new Headers(callAs(staffId, organizationId).headers);
    headers.set(SUPPORT_SESSION_HEADER, session.id);

    const result = await client.getWarehouseTopology({ warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1 }, { headers });
    expect(result.topology?.tenantId).toBe(organizationId);
    const stored = await storage.load();
    const audit = [...(stored?.collections.supportAuditEntries.values() ?? [])].map(TABLE_DEFINITIONS.supportAuditEntries.decode);
    expect(audit).toEqual([expect.objectContaining({
      action: SupportAuditAction.READ,
      method: 'wms.v1.WarehouseTopologyService/GetWarehouseTopology',
      outcome: SupportAuditOutcome.ALLOWED,
      sessionId: session.id,
    })]);
  });
});

const createAddition = (
  warehouseId: string = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_2,
): AddWarehouseCellsRequest => create(AddWarehouseCellsRequestSchema, {
  cells: [{
    cellCode: ' C01 ',
    rackCode: 'S01',
    rackFootprint: { depthMm: 500, origin: { xMm: 1_000, zMm: 1_000 }, widthMm: 600 },
    rowCode: 'R01',
    tierCode: 'Y01',
    tierElevationMm: 0,
    widthMm: 600,
    zoneCode: ' Z01 ',
  }],
  expectedRevision: 0,
  idempotencyKey: 'f0000000-0000-4000-8000-000000000003',
  warehouseId,
});

describe('AddWarehouseCells', () => {
  const admin = callAs(SeedUserId.ADMIN_1, SeedOrganizationId.CUSTOMER_1);

  it('initializes a new topology once and persists the original response for retries', async () => {
    const { engine, storage } = await createTestEngine();
    const request = createAddition();
    const client = createClient(WarehouseTopologyService, createEngineTransport(engine, true));
    const events: Event[] = [];
    const organizationEvents: Event[] = [];
    const headers = new Headers(admin.headers);
    const subscription = engine.subscribe(warehouseChannel(request.warehouseId), headers, published => events.push(...published));
    expect(subscription.kind).toBe('subscribed');
    expect(engine.subscribe(organizationChannel(SeedOrganizationId.CUSTOMER_1), headers, (published) => {
      organizationEvents.push(...published);
    }).kind).toBe('subscribed');

    expect(await client.addWarehouseCells(request, admin)).toMatchObject({ revision: 1 });
    expect(events.map(event => event.payload)).toEqual([{
      case: 'warehouseChanged',
      value: create(WarehouseChangedSchema, { change: WarehouseChange.TOPOLOGY_UPDATED, warehouseId: request.warehouseId }),
    }]);
    expect(organizationEvents).toEqual([]);
    const restarted = await createTestEngine({ storage });
    const restored = createClient(WarehouseTopologyService, createEngineTransport(restarted.engine, true));
    expect(await restored.addWarehouseCells(request, admin)).toMatchObject({ revision: 1 });
    const { topology } = await restored.getWarehouseTopology({ warehouseId: request.warehouseId }, admin);
    expect(topology?.storageZones).toMatchObject([{
      code: 'Z01',
      rows: [{ racks: [{ tiers: [{ cells: [{ code: 'C01' }], elevationMm: 0 }] }] }],
    }]);
    expect(topology?.receivingArea).toBeUndefined();
  });

  it('rejects omitted and stale revisions, and enforces layout permissions on the warehouse', async () => {
    const { engine } = await createTestEngine();
    const client = createClient(WarehouseTopologyService, createEngineTransport(engine, true));
    const request = createAddition(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1);
    const omitted = await captureError(client.addWarehouseCells({ ...request, expectedRevision: undefined }, admin));
    expect(readErrorDetail(omitted)).toMatchObject({
      code: ErrorCode.VALIDATION_FAILED,
      params: { value: { violations: [expect.objectContaining({ fieldPath: 'expected_revision' })] } },
    });
    const stale = await captureError(client.addWarehouseCells(request, admin));
    expect(readErrorDetail(stale)).toMatchObject({ code: ErrorCode.VERSION_CONFLICT, params: { value: { currentVersion: 1 } } });
    const storekeeper = callAs(SeedUserId.STOREKEEPER_1, SeedOrganizationId.CUSTOMER_1);
    const denied = await captureError(client.addWarehouseCells({ ...request, expectedRevision: 1 }, storekeeper));
    expect(readErrorDetail(denied).code).toBe(ErrorCode.PERMISSION_DENIED);
    const supplier = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
    const foreign = await captureError(client.addWarehouseCells({ ...request, expectedRevision: 1 }, supplier));
    expect(readErrorDetail(foreign).code).toBe(ErrorCode.NOT_FOUND);
  });

  it('reports a geometric conflict at the request row without changing topology', async () => {
    const { engine } = await createTestEngine();
    const client = createClient(WarehouseTopologyService, createEngineTransport(engine, true));
    const request = createAddition(SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1);
    const result = await captureError(client.addWarehouseCells({
      ...request,
      cells: request.cells.map(cell => ({ ...cell, tierCode: 'Y03', tierElevationMm: 3_000 })),
      expectedRevision: 1,
    }, admin));
    expect(readErrorDetail(result)).toMatchObject({
      code: ErrorCode.VALIDATION_FAILED,
      params: { value: { violations: [expect.objectContaining({ fieldPath: 'cells[0].rack_footprint' })] } },
    });
    expect((await client.getWarehouseTopology({ warehouseId: request.warehouseId }, admin)).topology?.revision).toBe(1);
  });

  it('commits the topology, idempotency and warehouse event together after a failed write', async () => {
    const { engine, storage } = await createTestEngine();
    const client = createClient(WarehouseTopologyService, createEngineTransport(engine, true));
    const request = createAddition();
    const events: Event[] = [];
    const headers = new Headers(admin.headers);
    const subscription = engine.subscribe(warehouseChannel(request.warehouseId), headers, published => events.push(...published));
    expect(subscription.kind).toBe('subscribed');

    storage.failNextCommit();
    const failed = await captureError(client.addWarehouseCells(request, admin));
    expect(readErrorDetail(failed).code).toBe(ErrorCode.UNAVAILABLE);
    expect((await client.getWarehouseTopology({ warehouseId: request.warehouseId }, admin)).topology).toBeUndefined();
    expect(events).toEqual([]);
    expect(await client.addWarehouseCells(request, admin)).toMatchObject({ revision: 1 });
    expect(events).toHaveLength(1);
  });

  it('allows one of two concurrent edits with the same expected revision', async () => {
    const { engine } = await createTestEngine();
    const client = createClient(WarehouseTopologyService, createEngineTransport(engine, true));
    const request = createAddition();
    const [first, second] = await Promise.allSettled([
      client.addWarehouseCells(request, admin),
      client.addWarehouseCells({ ...request, idempotencyKey: 'f0000000-0000-4000-8000-000000000004' }, admin),
    ]);
    expect(first).toMatchObject({ status: 'fulfilled', value: { revision: 1 } });
    expect(second).toMatchObject({ status: 'rejected' });

    if (second.status === 'rejected') {
      expect(readErrorDetail(ConnectError.from(second.reason))).toMatchObject({
        code: ErrorCode.VERSION_CONFLICT,
        params: { value: { currentVersion: 1 } },
      });
    }
  });
});
