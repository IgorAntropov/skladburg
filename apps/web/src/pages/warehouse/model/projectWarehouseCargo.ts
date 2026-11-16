import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';
import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';

import type {
  WarehouseCargoUnitValue,
  WarehouseCargoValue,
  WarehouseDockDepartureValue,
  WarehouseDockVisitValue,
} from './warehouseSceneCargo';

interface WarehouseCargoProjectionValue {
  picking: readonly PickingTask[] | undefined;
  trips: readonly Trip[] | undefined;
  warehouseId: string;
}

const isAtDock = (task: ReceivingTask): boolean =>
  task.status === ReceivingTaskStatus.OPEN || task.status === ReceivingTaskStatus.IN_PROGRESS;

const comparePickedAt = (current: PickingTask, prev: PickingTask): number => {
  const seconds = (current.pickedAt?.seconds ?? 0n) - (prev.pickedAt?.seconds ?? 0n);
  return seconds === 0n ? (current.pickedAt?.nanos ?? 0) - (prev.pickedAt?.nanos ?? 0) : seconds < 0n ? -1 : 1;
};

const compareOutboundVisits = (current: PickingTask, prev: PickingTask): number =>
  Number(prev.status === PickingTaskStatus.SHIPPED) - Number(current.status === PickingTaskStatus.SHIPPED)
  || comparePickedAt(current, prev);

const appendOutboundCargo = (
  { picking, trips, warehouseId }: WarehouseCargoProjectionValue,
  units: WarehouseCargoUnitValue[],
  hasDock: boolean,
  dockDepartures: Map<string, WarehouseDockDepartureValue>,
): { dockVisits: WarehouseDockVisitValue[]; shippedUnitIds: ReadonlySet<string> } => {
  const pickupTrips = new Map(trips?.filter(trip => trip.pickup?.warehouseId === warehouseId).map(trip => [trip.dealId, trip]));
  const dockTasks: PickingTask[] = [];
  const shippedUnitIds = new Set<string>();

  for (const task of picking ?? []) {
    const isShipped = task.status === PickingTaskStatus.SHIPPED;
    if (task.warehouseId !== warehouseId || (!isShipped && task.status !== PickingTaskStatus.PICKED)) {
      continue;
    }

    const trip = pickupTrips.get(task.dealId);
    const isAtSource = trip === undefined || trip.status === TripStatus.ASSIGNED || trip.status === TripStatus.LOADED;
    if (hasDock && isShipped) {
      if (trip === undefined) {
        dockDepartures.set(task.id, 'self-pickup');
      }
      else if (trip.status === TripStatus.IN_TRANSIT || trip.status === TripStatus.ARRIVED
        || trip.status === TripStatus.DELIVERED || trip.status === TripStatus.CLOSED) {
        dockDepartures.set(task.id, 'route');
      }
    }

    const before = units.length;
    for (const [index, { cellId, handlingUnit }] of task.units.entries()) {
      if (handlingUnit?.warehouseId !== warehouseId || handlingUnit.id === '' || cellId === '') {
        continue;
      }
      const { id } = handlingUnit;
      if (isShipped) {
        shippedUnitIds.add(id);
      }
      if (!hasDock || !isAtSource) {
        continue;
      }
      units.push({
        cellId,
        expectedUnitId: `shipment:${task.id}:${id}`,
        id,
        isOutbound: true,
        location: isShipped ? 'truck' : 'cell',
        slot: index,
        taskId: task.id,
        truckSlot: index,
      });
    }
    if (units.length > before && (!isShipped || trip !== undefined)) {
      dockTasks.push(task);
    }
  }

  return {
    dockVisits: dockTasks.sort(compareOutboundVisits).map(task => ({ taskId: task.id, tripId: pickupTrips.get(task.dealId)?.id })),
    shippedUnitIds,
  };
};

export const projectWarehouseCargo = (
  tasks: readonly ReceivingTask[],
  areaId: string | undefined,
  hasDock: boolean,
  options?: WarehouseCargoProjectionValue,
): WarehouseCargoValue => {
  const localTasks = tasks.filter(task => task.receivingAreaId === areaId && task.status !== ReceivingTaskStatus.UNSPECIFIED
    && (options === undefined || task.warehouseId === options.warehouseId));
  const arrived = hasDock ? localTasks.filter(isAtDock) : [];
  const units: WarehouseCargoUnitValue[] = [];
  const dockDepartures = new Map<string, WarehouseDockDepartureValue>();
  const receiptOrder = new Map<string, { index: number; time: bigint }>();

  for (const task of localTasks) {
    if (hasDock && (task.status === ReceivingTaskStatus.READY_FOR_RECONCILIATION || task.status === ReceivingTaskStatus.RECONCILED)) {
      dockDepartures.set(task.id, 'received');
    }
    const receipts = new Map(task.receivedUnits.map((unit, index) => {
      const timestamp = unit.receivedAt;
      receiptOrder.set(unit.expectedUnitId, { index, time: (timestamp?.seconds ?? 0n) * 1_000_000_000n + BigInt(timestamp?.nanos ?? 0) });
      return [unit.expectedUnitId, unit] as const;
    }));
    for (const [index, expected] of task.expectedUnits.entries()) {
      const received = receipts.get(expected.id);
      if (received === undefined && !isAtDock(task)) {
        continue;
      }

      const cellId = received?.putAwayCellId;
      const location = received === undefined ? 'truck' : cellId === undefined ? 'staging' : 'cell';
      units.push({
        cellId,
        expectedUnitId: expected.id,
        id: received?.balanceAtReceipt?.handlingUnit?.id ?? expected.id,
        location,
        slot: index,
        taskId: task.id,
        truckSlot: index,
      });
    }
  }

  const ordered = units.filter(unit => unit.location !== 'truck').sort((current, prev) => {
    const currentOrder = receiptOrder.get(current.expectedUnitId);
    const prevOrder = receiptOrder.get(prev.expectedUnitId);
    const currentTime = currentOrder?.time ?? 0n;
    const prevTime = prevOrder?.time ?? 0n;
    if (currentTime !== prevTime) {
      return currentTime < prevTime ? -1 : 1;
    }
    return current.taskId.localeCompare(prev.taskId) || (currentOrder?.index ?? 0) - (prevOrder?.index ?? 0);
  });
  for (const [slot, unit] of ordered.entries()) {
    unit.slot = slot;
  }

  const outbound = options === undefined ? undefined : appendOutboundCargo(options, units, hasDock, dockDepartures);
  const deliveryTrips = new Map(options?.trips
    ?.filter(trip => trip.delivery?.warehouseId === options.warehouseId && trip.status === TripStatus.ARRIVED)
    .map(trip => [trip.dealId, trip.id]));
  const dockVisits = [
    ...arrived.map(task => ({ taskId: task.id, tripId: deliveryTrips.get(task.dealId) })),
    ...(outbound?.dockVisits ?? []),
  ];
  const next = dockVisits[0];
  return {
    dockDepartures,
    dockTaskId: next?.taskId,
    dockTripId: next?.tripId,
    dockVisits,
    hasDock,
    shippedUnitIds: outbound?.shippedUnitIds,
    units,
  };
};
