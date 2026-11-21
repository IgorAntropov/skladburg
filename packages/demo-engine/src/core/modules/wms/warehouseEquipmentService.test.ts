import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { SUPPORT_SESSION_HEADER } from '@skladburg/contracts/runtime';
import {
  SupportAccessSection,
  SupportAccessStatus,
} from '@skladburg/contracts/support/v1/support_access';
import {
  WarehouseEquipmentKind,
  WarehouseEquipmentService,
  WarehouseEquipmentStatus,
  WarehouseEquipmentTaskKind,
  type WarehouseEquipmentUnit,
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
import { createTestSupportAccessSession } from '../../state/testRecords';
import {
  addTestMember,
  callAs,
  captureError,
  createModuleHarness,
  readErrorDetail,
} from '../testing/moduleHarness';
import { saveWarehouseEquipmentRecord } from './warehouseEquipmentRecords';

const TENANT = SeedOrganizationId.CUSTOMER_1;
const WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const OTHER = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1;
const DRIVER = SeedUserId.WAREHOUSE_OPERATOR;

it('filters task and driver independently by warehouse grant, work visibility and membership', async () => {
  const harness = createModuleHarness();
  const { random, runtime, transport } = harness;
  const client = createClient(WarehouseEquipmentService, transport);
  const id = random.uuid();
  const taskId = random.uuid();
  const stationId = random.uuid();
  const kind = WarehouseEquipmentTaskKind.RECEIVING;
  const record = create(WarehouseEquipmentRecordSchema, {
    equipment: [{
      unit: {
        batteryPercent: 79, capacityKg: 1_500, code: 'П-1', driverStaffId: DRIVER, id, kind: WarehouseEquipmentKind.FORKLIFT,
        liftHeightMm: 3_000, model: 'Грань-15', status: WarehouseEquipmentStatus.HANDLING, taskId, taskKind: kind,
      },
    }],
    stations: [{ code: 'З-1', id: stationId }], tenantId: TENANT, warehouseId: WAREHOUSE,
  });
  const supportId = SeedUserId.OPERATOR_SUPPORT_ENGINEER;
  const session = createTestSupportAccessSession(random.uuid(), TENANT, supportId, SupportAccessStatus.ACTIVE, {
    expiresAt: timestampFromMs(runtime.getWorldTimeMs() + 60_000), section: SupportAccessSection.WAREHOUSES,
  });
  await runtime.command((transaction) => {
    saveWarehouseEquipmentRecord(transaction, record);
    transaction.put('supportAccessSessions', session);
  });
  const storedEquipment = async (userId: string, supportSessionId: string | undefined): Promise<WarehouseEquipmentUnit> => {
    const headers = new Headers(callAs(userId, TENANT).headers);
    if (supportSessionId !== undefined) {
      headers.set(SUPPORT_SESSION_HEADER, supportSessionId);
    }
    const response = await client.getWarehouseEquipment({ warehouseId: WAREHOUSE }, { headers });
    expect(response.stations).toMatchObject([{ code: 'З-1', id: stationId }]);
    const [unit] = response.equipment;
    if (unit === undefined) {
      throw new Error('Missing equipment');
    }
    expect(unit).toMatchObject({ batteryPercent: 79, id, status: WarehouseEquipmentStatus.HANDLING });
    return unit;
  };

  for (const user of [SeedUserId.ADMIN_1, SeedUserId.WAREHOUSE_LEAD, DRIVER]) {
    expect(await storedEquipment(user, undefined)).toMatchObject({ driverStaffId: DRIVER, taskId, taskKind: kind });
  }
  for (const [user, sessionId] of [[SeedUserId.WAREHOUSE_PICKER, undefined], [supportId, session.id]] as const) {
    const unit = await storedEquipment(user, sessionId);
    expect(unit.driverStaffId).toBeUndefined();
    expect(unit).toMatchObject({ taskId, taskKind: kind });
  }
  const qualificationsViewer = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['warehouse_view', 'staff_profile_view', 'staff_qualification_view'], warehouseIds: [WAREHOUSE],
  });
  const otherGrants = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['task_view', 'staff_performance_view'], warehouseIds: [OTHER],
  });
  await runtime.command((transaction) => {
    const member = transaction.listBy('memberships', 'userId', qualificationsViewer)[0];
    const otherAssignment = transaction.listBy('memberships', 'userId', otherGrants)[0]?.roleAssignments[0];
    if (member === undefined || otherAssignment === undefined) {
      throw new Error('Missing test grants');
    }
    member.roleAssignments.push(otherAssignment);
    transaction.put('memberships', member);
  });
  for (const user of [SeedUserId.BUYER_1, qualificationsViewer]) {
    const unit = await storedEquipment(user, undefined);
    expect([unit.driverStaffId, unit.taskId, unit.taskKind]).toEqual([undefined, undefined, undefined]);
  }
  const staffViewer = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['warehouse_view', 'staff_profile_view', 'staff_performance_view'], warehouseIds: [WAREHOUSE],
  });
  const staffOnly = await storedEquipment(staffViewer, undefined);
  expect([staffOnly.driverStaffId, staffOnly.taskId, staffOnly.taskKind]).toEqual([DRIVER, undefined, undefined]);
});

it('rejects foreign, ungranted and out-of-scope reads and returns an empty inventory for an unconfigured warehouse', async () => {
  const harness = createModuleHarness();
  const client = createClient(WarehouseEquipmentService, harness.transport);
  const withTasksOnly = await addTestMember(harness, { organizationId: TENANT, permissions: ['task_view'], warehouseIds: [WAREHOUSE] });
  const record = { warehouseId: WAREHOUSE };
  for (const caller of [withTasksOnly, SeedUserId.STOREKEEPER_1]) {
    const error = await captureError(client.getWarehouseEquipment(record, callAs(caller, TENANT)));
    expect(readErrorDetail(error).code).toBe(ErrorCode.PERMISSION_DENIED);
  }
  const foreign = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
  expect(readErrorDetail(await captureError(client.getWarehouseEquipment(record, foreign))).code).toBe(ErrorCode.NOT_FOUND);
  const local = callAs(SeedUserId.ADMIN_1, TENANT);
  expect(await client.getWarehouseEquipment({ warehouseId: OTHER }, local)).toMatchObject({ equipment: [], stations: [] });
});
