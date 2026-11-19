import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  beginWarehouseYardGrab,
  findWarehouseYardDockTarget,
  readWarehouseYardDrop,
} from './warehouseYardDrag';

const initialPointer = { clientX: 40, clientY: 20, pointerId: 1 };
const droppedPointer = { clientX: 71, clientY: 42, pointerId: 1 };
const dock = { id: 'dock-6', x: 7, z: 8 };
const parked = [
  { slotIndex: 0, taskId: 'first' },
  { slotIndex: 27, taskId: 'rear' },
];
const options = new Map([
  ['first', { taskVersion: 2, unloadingPointIds: [] }],
  ['rear', { taskVersion: 8, unloadingPointIds: [dock.id] }],
]);

describe('warehouse yard drag', () => {
  it('selects the rendered instance index after sparse slot numbers have been compacted', () => {
    const grab = beginWarehouseYardGrab(parked, 1, options, initialPointer);
    expect(grab).toEqual({ ...initialPointer, taskId: 'rear', taskVersion: 8 });
    expect(beginWarehouseYardGrab(parked, 27, options, initialPointer)).toBeUndefined();
    expect(beginWarehouseYardGrab(parked, 0, options, initialPointer)).toBeUndefined();
  });

  it('accepts a deliberate drop on an available dock for the same active pointer and version', () => {
    const grab = beginWarehouseYardGrab(parked, 1, options, initialPointer);
    if (grab === undefined) {
      throw new Error('Expected the rear truck to be available');
    }
    expect(readWarehouseYardDrop(grab, droppedPointer, options, dock.id)).toEqual({
      taskId: 'rear', taskVersion: 8, unloadingPointId: dock.id,
    });
    expect(readWarehouseYardDrop(grab, initialPointer, options, dock.id)).toBeUndefined();
    expect(readWarehouseYardDrop(grab, { ...droppedPointer, pointerId: 2 }, options, dock.id)).toBeUndefined();
    expect(readWarehouseYardDrop(grab, droppedPointer, options, 'occupied')).toBeUndefined();
    const changed = new Map([['rear', { taskVersion: 9, unloadingPointIds: [dock.id] }]]);
    expect(readWarehouseYardDrop(grab, droppedPointer, changed, dock.id)).toBeUndefined();
  });

  it('finds the apron target in the same world space as its marker', () => {
    expect(findWarehouseYardDockTarget([dock], { x: 7, z: 5 })).toBe(dock.id);
    expect(findWarehouseYardDockTarget([dock], { x: 7, z: 8 })).toBeUndefined();
    expect(findWarehouseYardDockTarget([dock], { x: 9, z: 5 })).toBeUndefined();
  });
});
