import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import {
  ExpectedReceivingUnitSchema,
  ReceivedHandlingUnitSchema,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { projectWarehouseCargo } from './projectWarehouseCargo';
import { readWarehouseCargoMoves } from './warehouseSceneCargo';

const makeTask = (status: ReceivingTaskStatus, id = 'task', receivingAreaId = 'receiving'): ReceivingTask =>
  create(ReceivingTaskSchema, {
    expectedUnits: [{ id: id === 'task' ? 'expected' : `expected:${id}` }], id, receivingAreaId, status, version: 1,
  });

describe('warehouse scene cargo', () => {
  it('shows a truck only for an arrived task at the matching unloading point', () => {
    const tasks = [
      makeTask(ReceivingTaskStatus.OPEN, 'other', 'foreign'),
      makeTask(ReceivingTaskStatus.UNSPECIFIED, 'prepared'),
      makeTask(ReceivingTaskStatus.OPEN),
      makeTask(ReceivingTaskStatus.IN_PROGRESS, 'claimed'),
    ];

    expect(projectWarehouseCargo(tasks, 'receiving', false, undefined).dockTaskId).toBeUndefined();
    expect(projectWarehouseCargo(tasks, 'receiving', true, undefined).dockTaskId).toBe('claimed');
    expect(projectWarehouseCargo(tasks, 'receiving', true, 'task').dockTaskId).toBe('task');
  });

  it('starts from a restored snapshot and animates only new confirmed facts', () => {
    const initial = makeTask(ReceivingTaskStatus.IN_PROGRESS);
    const fact = create(ReceivedHandlingUnitSchema, {
      balanceAtReceipt: { handlingUnit: { id: 'actual' } },
      expectedUnitId: 'expected',
    });
    const received = create(ReceivingTaskSchema, { ...initial, receivedUnits: [fact] });
    const placed = create(ReceivingTaskSchema, {
      ...received,
      receivedUnits: [{ ...fact, putAwayCellId: 'cell' }],
    });
    const project = (task: typeof initial): ReturnType<typeof projectWarehouseCargo> =>
      projectWarehouseCargo([task], 'receiving', true, undefined);
    const before = project(initial);
    const middle = project(received);
    const after = project(placed);

    expect(readWarehouseCargoMoves(undefined, after)).toEqual([]);
    expect(readWarehouseCargoMoves(before, middle)).toMatchObject([{ id: 'actual', stops: ['truck', 'staging'] }]);
    expect(readWarehouseCargoMoves(middle, after)).toMatchObject([{ id: 'actual', stops: ['staging', 'cell'] }]);
    expect(readWarehouseCargoMoves(before, after)).toMatchObject([{ id: 'actual', stops: ['truck', 'staging', 'cell'] }]);
    expect(readWarehouseCargoMoves(after, project(placed))).toEqual([]);
  });

  it('animates a confirmed receipt for another active task even if it was not selected', () => {
    const dock = makeTask(ReceivingTaskStatus.IN_PROGRESS, 'claimed');
    const open = makeTask(ReceivingTaskStatus.OPEN);
    const received = create(ReceivingTaskSchema, {
      ...open,
      receivedUnits: [create(ReceivedHandlingUnitSchema, { expectedUnitId: 'expected' })],
    });
    const before = projectWarehouseCargo([dock, open], 'receiving', true, undefined);
    const after = projectWarehouseCargo([dock, received], 'receiving', true, undefined);

    expect(after.dockTaskId).toBe('claimed');
    expect(readWarehouseCargoMoves(before, after)).toMatchObject([{ id: 'expected', stops: ['truck', 'staging'] }]);
  });

  it('preserves the staging slot when an earlier item in the order is received later', () => {
    const task = makeTask(ReceivingTaskStatus.IN_PROGRESS);
    const expectedUnits = ['expected', 'second'].map(id => create(ExpectedReceivingUnitSchema, { id }));
    const firstReceipt = create(ReceivedHandlingUnitSchema, { expectedUnitId: 'second', receivedAt: { seconds: 1n } });
    const secondReceipt = create(ReceivedHandlingUnitSchema, { expectedUnitId: 'expected', receivedAt: { seconds: 1n } });
    const project = (receivedUnits: ReceivingTask['receivedUnits']): ReturnType<typeof projectWarehouseCargo> =>
      projectWarehouseCargo([{ ...task, expectedUnits, receivedUnits }], 'receiving', true, undefined);

    expect(project([firstReceipt]).units.find(unit => unit.id === 'second')?.slot).toBe(0);
    expect(project([firstReceipt, secondReceipt]).units.find(unit => unit.id === 'second')?.slot).toBe(0);
  });

  it('preserves staged facts and removes unreceived cargo when unloading closes', () => {
    const task = create(ReceivingTaskSchema, {
      ...makeTask(ReceivingTaskStatus.RECONCILED),
      expectedUnits: ['missing', 'expected'].map(id => create(ExpectedReceivingUnitSchema, { id })),
      receivedUnits: [create(ReceivedHandlingUnitSchema, {
        balanceAtReceipt: { handlingUnit: { id: 'actual' } },
        expectedUnitId: 'expected',
      })],
    });
    const closed = projectWarehouseCargo([task], 'receiving', true, undefined);

    expect(closed.dockTaskId).toBeUndefined();
    expect(closed.units).toMatchObject([{ id: 'actual', location: 'staging' }]);
    expect(projectWarehouseCargo([task], 'receiving', false, undefined).units).toEqual(closed.units);
  });
});
