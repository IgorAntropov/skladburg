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
import { WarehouseTopologyService } from '@skladburg/contracts/wms/v1/topology';
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
