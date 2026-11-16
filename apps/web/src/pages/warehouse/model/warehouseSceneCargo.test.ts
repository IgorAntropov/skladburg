import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';
import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import { TripSchema } from '@skladburg/contracts/logistics/v1/logistics';
import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import {
  PickingTaskSchema,
  PickingTaskStatus,
} from '@skladburg/contracts/wms/v1/picking';
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
import {
  readWarehouseCargoMoves,
  retainWarehouseDockOrder,
} from './warehouseSceneCargo';

const makeTask = (status: ReceivingTaskStatus, id = 'task', receivingAreaId = 'receiving'): ReceivingTask =>
  create(ReceivingTaskSchema, {
    expectedUnits: [{ id: id === 'task' ? 'expected' : `expected:${id}` }], id, receivingAreaId, status, version: 1,
  });

const makePicking = (status: PickingTaskStatus): PickingTask => create(PickingTaskSchema, {
  dealId: 'deal',
  id: 'picking',
  status,
  units: [{ cellId: 'source-cell', handlingUnit: { id: 'local-pallet', warehouseId: 'source' } }],
  version: 3,
  warehouseId: 'source',
});

const makeTrip = (status: TripStatus): Trip => create(TripSchema, {
  dealId: 'deal', delivery: { warehouseId: 'destination' }, id: 'trip', pickup: { warehouseId: 'source' }, status,
});

const projectPicking = (picking: PickingTask, trip?: Trip): ReturnType<typeof projectWarehouseCargo> =>
  projectWarehouseCargo([], 'receiving', true, {
    picking: [picking], trips: trip === undefined ? undefined : [trip], warehouseId: 'source',
  });

describe('warehouse scene cargo', () => {
  it('shows a truck only for an arrived task at the matching unloading point', () => {
    const tasks = [
      makeTask(ReceivingTaskStatus.OPEN, 'other', 'foreign'),
      makeTask(ReceivingTaskStatus.UNSPECIFIED, 'prepared'),
      makeTask(ReceivingTaskStatus.OPEN),
      makeTask(ReceivingTaskStatus.IN_PROGRESS, 'claimed'),
    ];

    expect(projectWarehouseCargo(tasks, 'receiving', false).dockTaskId).toBeUndefined();
    const projected = projectWarehouseCargo(tasks, 'receiving', true);
    expect(projected.dockTaskId).toBe('task');
    expect(projected.dockVisits?.map(visit => visit.taskId)).toEqual(['task', 'claimed']);
  });

  it('retains waiting order when a new arrival is listed first or a waiting receipt is claimed', () => {
    const first = makeTask(ReceivingTaskStatus.OPEN, 'first');
    const second = makeTask(ReceivingTaskStatus.OPEN, 'second');
    const newcomer = makeTask(ReceivingTaskStatus.IN_PROGRESS, 'new');
    const before = projectWarehouseCargo([first, second], 'receiving', true);
    const claimed = { ...second, status: ReceivingTaskStatus.IN_PROGRESS };
    const reordered = retainWarehouseDockOrder(before, projectWarehouseCargo([newcomer, claimed, first], 'receiving', true));

    expect(reordered.dockTaskId).toBe('first');
    expect(reordered.dockVisits?.map(visit => visit.taskId)).toEqual(['first', 'second', 'new']);
    const finished = { ...first, status: ReceivingTaskStatus.READY_FOR_RECONCILIATION };
    const released = retainWarehouseDockOrder(reordered, projectWarehouseCargo([newcomer, claimed, finished], 'receiving', true));
    expect(released.dockTaskId).toBe('second');
    expect(released.dockDepartures?.get('first')).toBe('received');
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
      projectWarehouseCargo([task], 'receiving', true);
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
    const before = projectWarehouseCargo([dock, open], 'receiving', true);
    const after = projectWarehouseCargo([dock, received], 'receiving', true);

    expect(after.dockTaskId).toBe('claimed');
    expect(readWarehouseCargoMoves(before, after)).toMatchObject([{ id: 'expected', stops: ['truck', 'staging'] }]);
  });

  it('preserves the staging slot when an earlier item in the order is received later', () => {
    const task = makeTask(ReceivingTaskStatus.IN_PROGRESS);
    const expectedUnits = ['expected', 'second'].map(id => create(ExpectedReceivingUnitSchema, { id }));
    const firstReceipt = create(ReceivedHandlingUnitSchema, { expectedUnitId: 'second', receivedAt: { seconds: 1n } });
    const secondReceipt = create(ReceivedHandlingUnitSchema, { expectedUnitId: 'expected', receivedAt: { seconds: 1n } });
    const project = (receivedUnits: ReceivingTask['receivedUnits']): ReturnType<typeof projectWarehouseCargo> =>
      projectWarehouseCargo([{ ...task, expectedUnits, receivedUnits }], 'receiving', true);

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
    const closed = projectWarehouseCargo([task], 'receiving', true);

    expect(closed.dockTaskId).toBeUndefined();
    expect(closed.dockDepartures?.get('task')).toBe('received');
    expect(closed.units).toMatchObject([{ id: 'actual', location: 'staging' }]);
    expect(projectWarehouseCargo([task], 'receiving', false).units).toEqual(closed.units);
  });

  it('loads a local pallet only after WMS confirms shipment', () => {
    const picked = projectPicking(makePicking(PickingTaskStatus.PICKED), makeTrip(TripStatus.ASSIGNED));
    const shipped = projectPicking(makePicking(PickingTaskStatus.SHIPPED), makeTrip(TripStatus.LOADED));

    expect(picked).toMatchObject({
      dockTaskId: 'picking', dockTripId: 'trip', units: [{ cellId: 'source-cell', id: 'local-pallet', location: 'cell' }],
    });
    expect(shipped).toMatchObject({
      dockTaskId: 'picking', dockTripId: 'trip', units: [{ id: 'local-pallet', isOutbound: true, location: 'truck' }],
    });
    expect(readWarehouseCargoMoves(picked, shipped)).toMatchObject([{ id: 'local-pallet', stops: ['cell', 'truck'] }]);
    expect(readWarehouseCargoMoves(undefined, shipped)).toEqual([]);
    expect(readWarehouseCargoMoves(shipped, shipped)).toEqual([]);
    expect(readWarehouseCargoMoves({ ...picked, dockTaskId: 'another-task' }, shipped)).toEqual([]);
    expect(readWarehouseCargoMoves(picked, { ...shipped, dockTaskId: 'another-task' })).toEqual([]);
  });

  it('holds a confirmed shipment at the matching source dock while the trip query is still assigned', () => {
    expect(projectPicking(makePicking(PickingTaskStatus.SHIPPED), makeTrip(TripStatus.ASSIGNED))).toMatchObject({
      dockTaskId: 'picking', dockTripId: 'trip', units: [{ id: 'local-pallet', location: 'truck' }],
    });
  });

  it.each([TripStatus.IN_TRANSIT, TripStatus.ARRIVED, TripStatus.DELIVERED, TripStatus.CLOSED, TripStatus.CANCELLED])(
    'clears the source dock and truck units when the related trip is in status %s',
    (status) => {
      const cargo = projectPicking(makePicking(PickingTaskStatus.SHIPPED), makeTrip(status));

      expect(cargo.dockTaskId).toBeUndefined();
      expect(cargo.dockTripId).toBeUndefined();
      expect(cargo.dockDepartures?.get('picking')).toBe(status === TripStatus.CANCELLED ? undefined : 'route');
      expect(cargo.shippedUnitIds).toEqual(new Set(['local-pallet']));
      expect(cargo.units).toEqual([]);
    },
  );

  it('supports a local handoff without keeping a truck at the dock after shipment', () => {
    const picked = projectPicking(makePicking(PickingTaskStatus.PICKED));
    const shipped = projectPicking(makePicking(PickingTaskStatus.SHIPPED));

    expect(picked.dockTaskId).toBe('picking');
    expect(shipped.dockTaskId).toBeUndefined();
    expect(shipped.dockTripId).toBeUndefined();
    expect(shipped.dockDepartures?.get('picking')).toBe('self-pickup');
    expect(readWarehouseCargoMoves(picked, shipped)).toMatchObject([{ id: 'local-pallet', stops: ['cell', 'truck'] }]);
  });

  it('keeps the confirmed removal from stock when the warehouse has no dock', () => {
    const cargo = projectWarehouseCargo([], 'receiving', false, {
      picking: [makePicking(PickingTaskStatus.SHIPPED)],
      trips: undefined,
      warehouseId: 'source',
    });

    expect(cargo.dockTaskId).toBeUndefined();
    expect(cargo.units).toEqual([]);
    expect(cargo.shippedUnitIds).toEqual(new Set(['local-pallet']));
  });

  it('uses only picking tasks in the open warehouse and trips for the same deal and endpoint', () => {
    const shipped = makePicking(PickingTaskStatus.SHIPPED);
    const loaded = makeTrip(TripStatus.LOADED);

    expect(projectPicking({ ...shipped, warehouseId: 'other' }, loaded).units).toEqual([]);
    expect(projectPicking(shipped, { ...loaded, pickup: loaded.delivery }).dockTripId).toBeUndefined();
    expect(projectPicking(shipped, { ...loaded, dealId: 'unrelated' }).dockTripId).toBeUndefined();
  });

  it('prioritizes an active receiving task and identifies the trip through the delivery warehouse', () => {
    const arrival = makeTrip(TripStatus.ARRIVED);
    const picking = makePicking(PickingTaskStatus.PICKED);
    const inbound = { ...makeTask(ReceivingTaskStatus.OPEN), dealId: 'deal', warehouseId: 'destination' };
    const atDestination = projectWarehouseCargo([inbound], 'receiving', true, {
      picking: [{ ...picking, warehouseId: 'destination' }], trips: [arrival], warehouseId: 'destination',
    });
    const atSource = projectWarehouseCargo([{ ...inbound, dealId: 'other-deal', warehouseId: 'source' }], 'receiving', true, {
      picking: [picking], trips: [makeTrip(TripStatus.ASSIGNED)], warehouseId: 'source',
    });

    expect(atDestination).toMatchObject({ dockTaskId: 'task', dockTripId: 'trip', units: [{ id: 'expected', location: 'truck' }] });
    expect(atSource.dockTaskId).toBe('task');
    expect(atSource.dockTripId).toBeUndefined();
  });
});
