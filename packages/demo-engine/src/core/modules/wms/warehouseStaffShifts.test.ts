import {
  expect,
  it,
} from 'vitest';

import { SEED_WAREHOUSE_STAFF_SCHEDULES } from '../../seed/seedWarehouseStaffSchedules';
import { SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID } from '../../seed/seedWarehouseWorkspaceConfig';
import { getWarehouseShiftPlan } from './warehouseStaffShifts';

const assignments = SEED_WAREHOUSE_STAFF_SCHEDULES.get(SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID) ?? [];
const time = (hour: number, minute: number): number => Date.UTC(2026, 9, 12, hour, minute);

it.each([
  [4, 59, 0, 0, 3],
  [5, 0, 3, 0, 0],
  [8, 59, 3, 0, 0],
  [9, 0, 1, 2, 0],
  [9, 29, 1, 2, 0],
  [9, 30, 2, 1, 0],
  [10, 0, 3, 0, 0],
  [14, 0, 0, 0, 3],
])('reads the local roster at %i:%i UTC', (hour, minute, onShiftCount, onBreakCount, offSiteCount) => {
  const { shift } = getWarehouseShiftPlan(assignments, time(hour, minute), 'Europe/Moscow');
  expect(shift).toEqual({ offSiteCount, onBreakCount, onShiftCount });
});

it('uses the warehouse time zone for the same instant', () => {
  const { shift } = getWarehouseShiftPlan(assignments, time(9, 0), 'Asia/Novosibirsk');
  expect(shift).toEqual({ offSiteCount: 0, onBreakCount: 0, onShiftCount: 3 });
});
