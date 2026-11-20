import type { WarehouseStaffAssignmentValue } from '../modules/wms/warehouseStaffShifts';

import { SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID } from './seedWarehouseWorkspaceConfig';

export const SEED_WAREHOUSE_STAFF_SCHEDULES: ReadonlyMap<string, readonly WarehouseStaffAssignmentValue[]> = new Map([
  [SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID, [
    {
      areaId: '8f000004-0000-4000-8000-000000000010',
      breakEndMinute: 12 * 60 + 30,
      breakStartMinute: 12 * 60,
      endMinute: 17 * 60,
      staffCount: 2,
      startMinute: 8 * 60,
    },
    {
      areaId: '8f000004-0000-4000-8000-000000000001',
      breakEndMinute: 13 * 60,
      breakStartMinute: 12 * 60 + 30,
      endMinute: 17 * 60,
      staffCount: 1,
      startMinute: 8 * 60,
    },
  ]],
]);
