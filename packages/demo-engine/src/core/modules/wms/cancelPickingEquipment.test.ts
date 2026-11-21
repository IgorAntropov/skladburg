import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import {
  DealSchema,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';
import {
  PickingTaskSchema,
  PickingTaskStatus,
  WarehousePickingService,
} from '@skladburg/contracts/wms/v1/picking';
import { StockBalanceSchema } from '@skladburg/contracts/wms/v1/stock';
import {
  WarehouseEquipmentKind,
  WarehouseEquipmentStatus,
} from '@skladburg/contracts/wms/v1/warehouse_equipment';
import { WarehouseEquipmentRecordSchema } from '@skladburg/contracts/wms/v1/warehouse_equipment_records';
import {
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { CUSTOMER_CALL } from '../catalog/showcase/testing/showcaseFixtures';
import { nextUuid } from '../catalog/testing/catalogFixtures';
import {
  callAs,
  createModuleHarness,
} from '../testing/moduleHarness';
import {
  openOutboundTask,
  saveOutboundTask,
} from './outboundRecords';
import { buildSsccKey } from './stockRecords';
import {
  readWarehouseEquipmentRecord,
  saveWarehouseEquipmentRecord,
} from './warehouseEquipmentRecords';

it.each([0, 1])('releases the supplier machine and its driver when the customer cancels after %d working minutes', async (elapsed) => {
  const { clock, deal, runtime, transport } = createModuleHarness();
  const picking = createClient(WarehousePickingService, transport);
  const warehouseId = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1;
  const tenantId = SeedOrganizationId.SUPPLIER_1;
  const userId = SeedUserId.ADMIN_2;
  const supplier = callAs(userId, tenantId);
  const kind = WarehouseStaffQualificationKind.FORKLIFT;
  const startedAt = runtime.getWorldTimeMs();
  runtime.openOutboundTask = openOutboundTask;
  runtime.wmsStaff = [{
    credentials: [{ expiresOn: create(CalendarDateSchema, { day: 12, month: 10, year: 2027 }), kind }],
    organizationId: tenantId,
    userId,
    warehouseId,
    workplace: undefined,
  }];
  const first = nextUuid();
  const second = nextUuid();
  const machineId = nextUuid();
  await runtime.command((transaction) => {
    for (const dealId of [first, second]) {
      transaction.put('deals', create(DealSchema, {
        customerOrganizationId: SeedOrganizationId.CUSTOMER_1, id: dealId, shipFromWarehouseId: warehouseId,
        status: DealStatus.PAID, supplierOrganizationId: tenantId, version: 5,
      }));
      const id = nextUuid();
      const sscc = dealId === first ? '000000000000000017' : '000000000000000024';
      const balance = create(StockBalanceSchema, { handlingUnit: { id, sscc, tenantId, warehouseId } });
      transaction.put('stockBalances', {
        bytes: toBinary(StockBalanceSchema, balance), id, lookupKey: buildSsccKey(tenantId, sscc), scopeId: warehouseId,
      });
      saveOutboundTask(transaction, runtime, create(PickingTaskSchema, {
        dealId, id: dealId, requiredQualifications: [kind], status: PickingTaskStatus.OPEN, units: [balance], version: 1, warehouseId,
      }), tenantId, false);
    }
    saveWarehouseEquipmentRecord(transaction, create(WarehouseEquipmentRecordSchema, {
      equipment: [{
        unit: { batteryPercent: 20, id: machineId, kind: WarehouseEquipmentKind.FORKLIFT, status: WarehouseEquipmentStatus.AVAILABLE },
        updatedAtMs: BigInt(startedAt),
      }],
      stations: [{ id: nextUuid() }], tenantId, warehouseId,
    }));
  });
  const claim = (taskId: string): Promise<unknown> =>
    picking.claimPickingTask({ expectedVersion: 1, idempotencyKey: nextUuid(), taskId, warehouseId }, supplier);
  await claim(first);
  clock.now = () => startedAt + elapsed * 60_000;
  const cancel = { dealId: first, expectedVersion: 6, idempotencyKey: nextUuid(), reason: 'Отмена поставки' };
  const cancelled = await deal.cancelDeal(cancel, CUSTOMER_CALL);
  expect(cancelled.deal?.status).toBe(DealStatus.CANCELLED);
  const released = readWarehouseEquipmentRecord(runtime.read, warehouseId);
  const status = elapsed === 0 ? WarehouseEquipmentStatus.AVAILABLE : WarehouseEquipmentStatus.CHARGING;
  expect(released?.equipment[0]?.unit).toMatchObject({ batteryPercent: 20 - elapsed, status });
  expect(released?.equipment[0]?.unit?.driverStaffId).toBeUndefined();
  expect(released?.equipment[0]?.unit?.taskId).toBeUndefined();
  expect(released?.stations[0]?.equipmentId).toBe(elapsed === 0 ? undefined : machineId);
  expect(await deal.cancelDeal(cancel, CUSTOMER_CALL)).toEqual(cancelled);
  expect(readWarehouseEquipmentRecord(runtime.read, warehouseId)).toEqual(released);
  clock.now = () => startedAt + 90 * 60_000;
  await claim(second);
  expect(readWarehouseEquipmentRecord(runtime.read, warehouseId)?.equipment[0]?.unit).toMatchObject({
    driverStaffId: userId, status: WarehouseEquipmentStatus.TO_TASK, taskId: second,
  });
});
