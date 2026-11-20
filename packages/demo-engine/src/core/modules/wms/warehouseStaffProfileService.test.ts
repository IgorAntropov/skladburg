import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import { RoleAssignmentSchema } from '@skladburg/contracts/access/v1/access';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';
import { SUPPORT_SESSION_HEADER } from '@skladburg/contracts/runtime';
import {
  SupportAccessSection,
  SupportAccessStatus,
} from '@skladburg/contracts/support/v1/support_access';
import {
  PickingTaskSchema,
  PickingTaskStatus,
} from '@skladburg/contracts/wms/v1/picking';
import {
  ReceivedHandlingUnitSchema,
  type ReceivingTask,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  type WarehouseStaffProfile,
  WarehouseStaffProfileService,
  WarehouseStaffQualificationStatus,
  WarehouseStaffShiftState,
  WarehouseStaffTaskKind,
} from '@skladburg/contracts/wms/v1/warehouse_staff_profile';
import {
  expect,
  it,
} from 'vitest';

import { SEED_WORLD_START_MS } from '../../seed/seedConfig';
import {
  SeedMembershipId,
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { createSeedWarehouseTopology } from '../../seed/seedWarehouseTopologies';
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
import { saveOutboundTask } from './outboundRecords';
import { encodeWarehouseTopology } from './warehouseTopologyCodec';

const TENANT = SeedOrganizationId.CUSTOMER_1;
const WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3;
const LEAD = SeedUserId.WAREHOUSE_LEAD;
const OPERATOR = SeedUserId.WAREHOUSE_OPERATOR;
const PICKER = SeedUserId.WAREHOUSE_PICKER;
const receivingAreaId = '8f000004-0000-4000-8000-000000000010';
const director = callAs(SeedUserId.ADMIN_1, TENANT);

interface StaffHarnessValue extends ReturnType<typeof createModuleHarness> {
  client: ReturnType<typeof createClient<typeof WarehouseStaffProfileService>>;
}

const setup = (): StaffHarnessValue => {
  const harness = createModuleHarness();
  return { ...harness, client: createClient(WarehouseStaffProfileService, harness.transport) };
};

const newTask = (status: ReceivingTaskStatus, finishedMs: number | undefined): ReceivingTask => {
  const id = nextUuid();
  return create(ReceivingTaskSchema, {
    assigneeUserId: OPERATOR, dealId: id, expectedUnits: [{ id: nextUuid() }],
    finishedAt: finishedMs === undefined ? undefined : timestampFromMs(finishedMs),
    id, orderLines: [{ dealLineId: nextUuid() }], receivingAreaId, sourceDocumentNumber: 'DEMO-STAFF', status, warehouseId: WAREHOUSE,
  });
};

it('projects the same roster by warehouse, area, team and field permissions for directory and detail', async () => {
  const { client } = setup();
  const listIds = async (userId: string): Promise<string[]> =>
    (await client.listWarehouseStaff({ warehouseId: WAREHOUSE }, callAs(userId, TENANT))).staff.map(member => member.staffId);
  const profile = async (viewerId: string, staffId: string): Promise<undefined | WarehouseStaffProfile> =>
    (await client.getWarehouseStaffProfile({ staffId, warehouseId: WAREHOUSE }, callAs(viewerId, TENANT))).profile;

  expect(await listIds(SeedUserId.ADMIN_1)).toEqual([LEAD, OPERATOR, PICKER]);
  expect(await listIds(LEAD)).toEqual([LEAD, OPERATOR, PICKER]);
  expect(await listIds(OPERATOR)).toEqual([LEAD, OPERATOR]);
  expect(await listIds(PICKER)).toEqual([PICKER]);
  expect((await client.listWarehouseStaff({}, callAs(OPERATOR, TENANT))).staff.map(member => member.staffId)).toEqual([LEAD, OPERATOR]);
  expect((await client.listWarehouseStaff({}, callAs(SeedUserId.COMPANY_ADMIN, TENANT))).staff).toHaveLength(4);
  expect((await client.listWarehouseStaff({ page: { pageSize: 2 }, warehouseId: WAREHOUSE }, director)).page?.nextPageToken).toBeTruthy();

  const own = await profile(OPERATOR, OPERATOR);
  expect(own?.summary?.observedAreaId).toBeUndefined();
  expect(own?.performance).toBeDefined();
  expect(own?.work?.shiftState).toBe(WarehouseStaffShiftState.ON_SHIFT);
  expect(own?.qualifications?.entries).toEqual(expect.arrayContaining([expect.objectContaining({
    kind: WarehouseStaffQualificationKind.FORKLIFT, status: WarehouseStaffQualificationStatus.VALID,
  })]));
  expect((await profile(LEAD, OPERATOR))?.performance).toBeDefined();
  for (const row of [await profile(OPERATOR, LEAD), await profile(LEAD, PICKER)]) {
    expect(row?.work?.activeTasks).toEqual([]);
    expect(row?.work?.shiftState).toBeUndefined();
    expect(row?.qualifications).toBeUndefined();
    expect(row?.performance).toBeUndefined();
  }
  const admin = await profile(SeedUserId.COMPANY_ADMIN, PICKER);
  expect(admin?.qualifications?.entries.map(entry => entry.status)).toEqual([
    WarehouseStaffQualificationStatus.EXPIRED, WarehouseStaffQualificationStatus.EXPIRING,
  ]);
  expect(admin?.work).toBeUndefined();
  expect(admin?.performance).toBeUndefined();
  const denied = await captureError(client.getWarehouseStaffProfile({ staffId: PICKER, warehouseId: WAREHOUSE }, callAs(OPERATOR, TENANT)));
  expect(readErrorDetail(denied).code).toBe(ErrorCode.NOT_FOUND);
  const self = await client.getWarehouseStaffProfile({
    staffId: SeedUserId.STOREKEEPER_1, warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
  }, callAs(SeedUserId.STOREKEEPER_1, TENANT));
  expect(self.profile?.performance?.completedThisShift).toBeUndefined();
});

it('denies foreign organizations, scopes, guessed staff identities and a support session over all sections', async () => {
  const { client, runtime } = setup();
  const request = { staffId: OPERATOR, warehouseId: WAREHOUSE };
  const supportId = SeedUserId.OPERATOR_SUPPORT_ENGINEER;
  const session = createTestSupportAccessSession(nextUuid(), TENANT, supportId, SupportAccessStatus.ACTIVE, {
    expiresAt: timestampFromMs(runtime.getWorldTimeMs() + 60_000), section: SupportAccessSection.ALL,
  });
  await runtime.command((transaction) => {
    transaction.put('supportAccessSessions', session);
  });
  const headers = new Headers(callAs(supportId, TENANT).headers);
  headers.set(SUPPORT_SESSION_HEADER, session.id);

  for (const caller of [
    callAs(SeedUserId.STOREKEEPER_1, TENANT),
    callAs(SeedUserId.BUYER_1, TENANT),
    { headers },
  ]) {
    expect(readErrorDetail(await captureError(client.getWarehouseStaffProfile(request, caller))).code).toBe(ErrorCode.PERMISSION_DENIED);
    const listError = await captureError(client.listWarehouseStaff({ warehouseId: WAREHOUSE }, caller));
    expect(readErrorDetail(listError).code).toBe(ErrorCode.PERMISSION_DENIED);
  }
  const foreign = callAs(SeedUserId.ADMIN_2, SeedOrganizationId.SUPPLIER_1);
  expect((await client.listWarehouseStaff({}, foreign)).staff).toEqual([]);
  expect(readErrorDetail(await captureError(client.getWarehouseStaffProfile(request, foreign))).code).toBe(ErrorCode.NOT_FOUND);
  expect(readErrorDetail(await captureError(client.getWarehouseStaffProfile({ ...request, staffId: nextUuid() }, director))).code)
    .toBe(ErrorCode.NOT_FOUND);
});

it('uses confirmed operations for the current area, all concurrent tasks and the shift and week counts', async () => {
  const { client, runtime } = setup();
  const active = newTask(ReceivingTaskStatus.IN_PROGRESS, undefined);
  active.receivedUnits.push(create(ReceivedHandlingUnitSchema, {
    putAwayAt: timestampFromMs(SEED_WORLD_START_MS),
    putAwayCellId: '8f000004-0000-4000-8000-000000000006',
    receivedAt: timestampFromMs(SEED_WORLD_START_MS - 10_000),
  }));
  const another = newTask(ReceivingTaskStatus.IN_PROGRESS, undefined);
  const completed = newTask(ReceivingTaskStatus.RECONCILED, SEED_WORLD_START_MS);
  const beforeShift = newTask(ReceivingTaskStatus.RECONCILED, SEED_WORLD_START_MS - 3 * 3_600_000);
  const lastWeek = newTask(ReceivingTaskStatus.RECONCILED, SEED_WORLD_START_MS - 24 * 3_600_000);
  const picked = nextUuid();
  const outbound = create(PickingTaskSchema, {
    assigneeUserId: OPERATOR, dealId: picked, id: picked, pickedAt: timestampFromMs(SEED_WORLD_START_MS),
    status: PickingTaskStatus.PICKED, units: [{ handlingUnit: { tenantId: TENANT, warehouseId: WAREHOUSE } }], warehouseId: WAREHOUSE,
  });
  await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(createSeedWarehouseTopology({
      prefix: '8f000004', tenantId: TENANT, warehouseId: WAREHOUSE,
    })));
    for (const task of [active, another, completed, beforeShift, lastWeek]) {
      saveInboundTask(transaction, runtime, task, TENANT);
    }
    saveOutboundTask(transaction, runtime, outbound, TENANT, true);
  });
  const row = (await client.getWarehouseStaffProfile({ staffId: OPERATOR, warehouseId: WAREHOUSE }, director)).profile;
  expect(row?.work?.activeTasks.map(task => task.taskId).sort()).toEqual([active.id, another.id].sort());
  expect(row?.performance).toMatchObject({ completedThisShift: 2, completedThisWeek: 3 });
  expect(row?.performance?.history).toHaveLength(4);
  expect(row?.performance?.history.filter(task => task.kind === WarehouseStaffTaskKind.PICKING)).toHaveLength(1);
  await runtime.command((transaction) => {
    outbound.status = PickingTaskStatus.SHIPPED;
    outbound.shippedAt = timestampFromMs(SEED_WORLD_START_MS);
    saveOutboundTask(transaction, runtime, outbound, TENANT, true);
  });
  const shipped = (await client.getWarehouseStaffProfile({ staffId: OPERATOR, warehouseId: WAREHOUSE }, director)).profile;
  expect(shipped?.performance).toEqual(row?.performance);
  expect(shipped?.work).toEqual(row?.work);
  const colleagueView = await client.listWarehouseStaff({ warehouseId: WAREHOUSE }, callAs(OPERATOR, TENANT));
  expect(colleagueView.staff.map(member => member.staffId)).toEqual([OPERATOR, PICKER]);
});

it('exposes an observed work area only while an authorized viewer has unambiguous evidence', async () => {
  const { client, runtime } = setup();
  const active = newTask(ReceivingTaskStatus.IN_PROGRESS, undefined);
  const conflicting = newTask(ReceivingTaskStatus.IN_PROGRESS, undefined);
  const at = timestampFromMs(SEED_WORLD_START_MS);
  active.receivedUnits.push(create(ReceivedHandlingUnitSchema, {
    putAwayAt: at, putAwayCellId: '8f000004-0000-4000-8000-000000000006',
  }));
  conflicting.receivedUnits.push(create(ReceivedHandlingUnitSchema, { receivedAt: at }));
  await runtime.command((transaction) => {
    transaction.put('warehouseTopologies', encodeWarehouseTopology(createSeedWarehouseTopology({
      prefix: '8f000004', tenantId: TENANT, warehouseId: WAREHOUSE,
    })));
    saveInboundTask(transaction, runtime, active, TENANT);
  });
  const request = { staffId: OPERATOR, warehouseId: WAREHOUSE };
  const row = (await client.getWarehouseStaffProfile(request, director)).profile;
  const observedZone = '8f000004-0000-4000-8000-000000000001';
  expect(row?.summary?.observedAreaId).toBe(observedZone);
  const directorList = await client.listWarehouseStaff({ warehouseId: WAREHOUSE }, director);
  expect(directorList.staff.map(member => member.observedAreaId)).toEqual([undefined, observedZone, undefined]);
  const admin = callAs(SeedUserId.COMPANY_ADMIN, TENANT);
  const adminList = await client.listWarehouseStaff({ warehouseId: WAREHOUSE }, admin);
  expect(adminList.staff.map(member => member.observedAreaId)).toEqual([undefined, undefined, undefined]);
  const adminProfile = await client.getWarehouseStaffProfile(request, admin);
  expect(adminProfile.profile?.summary?.observedAreaId).toBeUndefined();
  const neighbourView = await client.listWarehouseStaff({ warehouseId: WAREHOUSE }, callAs(PICKER, TENANT));
  expect(neighbourView.staff.find(member => member.staffId === OPERATOR)?.observedAreaId).toBe(observedZone);
  await runtime.command((transaction) => {
    saveInboundTask(transaction, runtime, conflicting, TENANT);
  });
  const ambiguous = await client.getWarehouseStaffProfile(request, director);
  expect(ambiguous.profile?.summary?.observedAreaId).toBeUndefined();
  await runtime.command((transaction) => {
    for (const task of [active, conflicting]) {
      task.status = ReceivingTaskStatus.RECONCILED;
      saveInboundTask(transaction, runtime, task, TENANT);
    }
  });
  const closed = await client.getWarehouseStaffProfile(request, director);
  expect(closed.profile?.summary?.observedAreaId).toBeUndefined();
});

it('keeps performance and credentials independent and preserves colleague work when another grant is assigned', async () => {
  const harness = setup();
  const metricsViewer = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['staff_profile_view', 'staff_performance_view'], warehouseIds: [WAREHOUSE],
  });
  const request = { staffId: LEAD, warehouseId: WAREHOUSE };
  const kpi = (await harness.client.getWarehouseStaffProfile(request, callAs(metricsViewer, TENANT))).profile;
  expect(kpi?.performance).toBeDefined();
  expect(kpi?.qualifications).toBeUndefined();

  const qualificationsViewer = await addTestMember(harness, {
    organizationId: TENANT, permissions: ['staff_qualification_view'], warehouseIds: [WAREHOUSE],
  });
  await harness.runtime.command((transaction) => {
    const member = transaction.get('memberships', SeedMembershipId.WAREHOUSE_OPERATOR);
    const assignment = transaction.listBy('memberships', 'userId', qualificationsViewer)[0]?.roleAssignments[0];
    if (member === undefined || assignment === undefined) {
      throw new Error('Missing seed staff membership');
    }
    member.roleAssignments.push(create(RoleAssignmentSchema, { roleId: assignment.roleId, warehouseIds: [WAREHOUSE] }));
    transaction.put('memberships', member);
  });
  const colleague = (await harness.client.getWarehouseStaffProfile(request, callAs(OPERATOR, TENANT))).profile;
  expect(colleague?.qualifications).toBeDefined();
  expect(colleague?.work?.activeTasks).toEqual([]);
  expect(colleague?.performance).toBeUndefined();
  const otherArea = (await harness.client.getWarehouseStaffProfile({ ...request, staffId: PICKER }, callAs(OPERATOR, TENANT))).profile;
  expect(otherArea?.work).toBeUndefined();
  expect(otherArea?.qualifications).toBeDefined();
});
