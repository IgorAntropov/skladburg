import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WarehouseDockVisitValue } from './warehouseSceneCargo';

import { readWarehouseSceneParking } from './warehouseSceneParking';

const waiting = (count: number): WarehouseDockVisitValue[] => Array.from({ length: count }, (_, index) => ({
  isWaitingInYard: true,
  taskId: `waiting-${String(index)}`,
  tripId: undefined,
  unloadingPointId: undefined,
}));

describe('warehouse parking sections', () => {
  it.each([
    [0, 3], [1, 3], [3, 3], [4, 6], [20, 20], [25, 26], [31, 30],
  ])('opens sections for %s waiting visits with capacity %s', (count, capacity) => {
    expect(readWarehouseSceneParking(undefined, 'warehouse', waiting(count), ['D01', 'D02'], undefined).capacity).toBe(capacity);
  });

  it('retains open sections until switching warehouses', () => {
    const previous = readWarehouseSceneParking(undefined, 'warehouse', waiting(25), ['D01'], undefined);

    expect(readWarehouseSceneParking(previous, 'warehouse', waiting(3), ['D01'], undefined)).toBe(previous);
    expect(readWarehouseSceneParking(previous, 'warehouse', undefined, ['D01'], undefined)).toBe(previous);
    expect(readWarehouseSceneParking(previous, 'other', waiting(3), ['D01'], undefined)).toEqual({ capacity: 3, warehouseId: 'other' });
  });

  it('counts distinct waiting visits and excludes already assigned trucks', () => {
    const visits = waiting(3);
    const [duplicate] = visits;
    const snapshot = duplicate === undefined
      ? visits
      : [...visits, duplicate, {
          taskId: 'assigned', tripId: undefined, unloadingPointId: 'D02',
        }];

    expect(readWarehouseSceneParking(undefined, 'warehouse', snapshot, ['D01', 'D02'], 'assigned').capacity).toBe(3);
  });

  it('counts extra outbound visits when one can use the primary dock', () => {
    const outbound: WarehouseDockVisitValue[] = Array.from({ length: 2 }, (_, index) => ({
      isOutbound: true, taskId: `outbound-${String(index)}`, tripId: undefined,
    }));
    const visits = [...waiting(3), ...outbound];

    expect(readWarehouseSceneParking(undefined, 'warehouse', visits, ['D01', 'D02'], 'outbound-0').capacity).toBe(6);
    expect(readWarehouseSceneParking(undefined, 'warehouse', visits, ['D01'], 'outbound-0').capacity).toBe(6);
  });
});
