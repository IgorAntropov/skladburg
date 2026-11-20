import { create } from '@bufbuild/protobuf';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { WarehouseStaffQualificationKind } from '@skladburg/contracts/common/v1/warehouse_staff_qualification';

import type {
  WarehouseStaffCredentialValue,
  WarehouseStaffMemberValue,
} from '../modules/wms/warehouseStaffRoster';

import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from './seedIds';

const validForklift: WarehouseStaffCredentialValue = {
  expiresOn: create(CalendarDateSchema, { day: 12, month: 10, year: 2027 }),
  kind: WarehouseStaffQualificationKind.FORKLIFT,
};

const coldRoom: WarehouseStaffCredentialValue = {
  expiresOn: create(CalendarDateSchema, { day: 25, month: 10, year: 2026 }),
  kind: WarehouseStaffQualificationKind.COLD_ROOM,
};

const medicalBook: WarehouseStaffCredentialValue = {
  expiresOn: create(CalendarDateSchema, { day: 2, month: 2, year: 2027 }),
  kind: WarehouseStaffQualificationKind.MEDICAL_BOOK,
};

const kazan = { organizationId: SeedOrganizationId.CUSTOMER_1, warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_3 };

export const SEED_WAREHOUSE_STAFF: readonly WarehouseStaffMemberValue[] = [
  {
    ...kazan,
    credentials: [validForklift, coldRoom, medicalBook],
    userId: SeedUserId.WAREHOUSE_LEAD,
    workplace: {
      areaId: '8f000004-0000-4000-8000-000000000010',
      isTeamLead: true,
      teamId: 'receiving',
      workRole: 'SHIFT_LEAD',
    },
  },
  {
    ...kazan,
    credentials: [validForklift, medicalBook],
    userId: SeedUserId.WAREHOUSE_OPERATOR,
    workplace: {
      areaId: '8f000004-0000-4000-8000-000000000010',
      isTeamLead: false,
      teamId: 'receiving',
      workRole: 'FORKLIFT_OPERATOR',
    },
  },
  {
    ...kazan,
    credentials: [
      { expiresOn: create(CalendarDateSchema, { day: 11, month: 10, year: 2026 }), kind: WarehouseStaffQualificationKind.FORKLIFT },
      coldRoom,
    ],
    userId: SeedUserId.WAREHOUSE_PICKER,
    workplace: {
      areaId: '8f000004-0000-4000-8000-000000000001',
      isTeamLead: false,
      teamId: 'storage',
      workRole: 'PICKER',
    },
  },
  { ...kazan, credentials: [validForklift], userId: SeedUserId.ADMIN_1, workplace: undefined },
  {
    credentials: [],
    organizationId: SeedOrganizationId.CUSTOMER_1,
    userId: SeedUserId.STOREKEEPER_1,
    warehouseId: SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1,
    workplace: { areaId: '8f000002-0000-4000-8000-000000000010', isTeamLead: false, teamId: undefined, workRole: 'STOREKEEPER' },
  },
  {
    credentials: [],
    organizationId: SeedOrganizationId.CUSTOMER_2,
    userId: SeedUserId.STOREKEEPER_2,
    warehouseId: SeedWarehouseId.CUSTOMER_2_SITE_1,
    workplace: { areaId: undefined, isTeamLead: false, teamId: undefined, workRole: 'STOREKEEPER' },
  },
];
