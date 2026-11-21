import { staffProfilesChannel } from '@skladburg/contracts/runtime';
import {
  expect,
  it,
} from 'vitest';

import { SEED_WAREHOUSE_STAFF_SCHEDULES } from '../../seed/seedWarehouseStaffSchedules';
import { SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID } from '../../seed/seedWarehouseWorkspaceConfig';
import { createTestRuntime } from '../testing/testRuntime';
import {
  getWarehouseShiftPlan,
  publishWarehouseShiftChanges,
} from './warehouseStaffShifts';

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

it('refreshes private profiles at warehouse midnight even without a shift schedule', async () => {
  const { events, runtime } = createTestRuntime();
  const withoutShifts = { ...runtime, wmsStaffSchedules: undefined };
  const channel = staffProfilesChannel(SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID);
  await publishWarehouseShiftChanges(withoutShifts, time(20, 58), time(20, 59));
  expect(events.filter(event => event.channel === channel)).toHaveLength(0);
  await publishWarehouseShiftChanges(withoutShifts, time(20, 59), time(21, 0));
  expect(events.filter(event => event.channel === channel).map(event => event.payload)).toEqual([{
    case: 'warehouseStaffProfilesChanged',
    value: { $typeName: 'wms.v1.WarehouseStaffProfilesChanged', warehouseId: SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID },
  }]);
});

it('keeps the clock running when a saved warehouse lacks a local time zone', async () => {
  const { events, runtime } = createTestRuntime();
  await runtime.command((transaction) => {
    const warehouse = transaction.get('warehouses', SEED_WMS_RECEIVING_EXAMPLES_WAREHOUSE_ID);
    if (warehouse === undefined) {
      throw new Error('Missing warehouse');
    }
    transaction.put('warehouses', { ...warehouse, timeZone: '' });
  });
  await publishWarehouseShiftChanges(runtime, time(8, 59), time(9, 0));
  expect(events).toHaveLength(0);
});
