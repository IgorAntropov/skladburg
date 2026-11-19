import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';
import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';

import type {
  WarehouseCargoUnitValue,
  WarehouseCargoValue,
  WarehouseDockVisitValue,
  WarehouseYardVisitValue,
} from './warehouseSceneCargo';

import {
  isWarehouseVisitActive,
  projectInboundYardVisit,
  projectOutboundYardVisit,
} from './projectWarehouseYardVisit';

interface WarehouseCargoProjectionValue {
  knownPickupDeals?: ReadonlySet<string> | undefined;
  picking: readonly PickingTask[] | undefined;
  trips: readonly Trip[] | undefined;
  warehouseId: string;
}

const comparePickedAt = (current: PickingTask, prev: PickingTask): number => {
  const seconds = (current.pickedAt?.seconds ?? 0n) - (prev.pickedAt?.seconds ?? 0n);
  return seconds === 0n ? (current.pickedAt?.nanos ?? 0) - (prev.pickedAt?.nanos ?? 0) : seconds < 0n ? -1 : 1;
};

const compareOutboundVisits = (current: PickingTask, prev: PickingTask): number =>
  Number(prev.status === PickingTaskStatus.SHIPPED) - Number(current.status === PickingTaskStatus.SHIPPED)
  || comparePickedAt(current, prev);

const appendOutboundCargo = (
  { knownPickupDeals, picking, trips, warehouseId }: WarehouseCargoProjectionValue,
  units: WarehouseCargoUnitValue[],
  hasDock: boolean,
  yardVisits: Map<string, WarehouseYardVisitValue>,
): { dockVisits: WarehouseDockVisitValue[]; shippedUnitIds: ReadonlySet<string> } => {
  const pickupTrips = new Map(trips?.filter(trip => trip.pickup?.warehouseId === warehouseId).map(trip => [trip.dealId, trip]));
  const dockTasks: { task: PickingTask; visit: WarehouseDockVisitValue }[] = [];
  const shippedUnitIds = new Set<string>();

  for (const task of picking ?? []) {
    const isShipped = task.status === PickingTaskStatus.SHIPPED;
    if (task.warehouseId !== warehouseId) {
      continue;
    }
    const canConfirmSelfPickup = trips !== undefined && knownPickupDeals?.has(task.dealId) !== true;
    const visit = projectOutboundYardVisit(task, pickupTrips.get(task.dealId), canConfirmSelfPickup);
    const isActive = isWarehouseVisitActive(visit);
    const isSelfPickup = visit?.phase === 'departed' && visit.departure === 'self-pickup';
    const isAwaitingShipment = visit?.phase === 'awaiting-shipment';
    if (hasDock && visit !== undefined) {
      yardVisits.set(task.id, visit);
    }
    if (!isShipped && !isActive && !isAwaitingShipment) {
      continue;
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
      if (!hasDock || (!isActive && !isSelfPickup && !isAwaitingShipment)) {
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
    if (units.length > before && isActive) {
      dockTasks.push({ task, visit });
    }
  }

  return {
    dockVisits: dockTasks.sort((current, prev) => compareOutboundVisits(current.task, prev.task)).map(({ visit }) => visit),
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
  const deliveryTrips = new Map(options?.trips
    ?.filter(trip => trip.delivery?.warehouseId === options.warehouseId && trip.status !== TripStatus.CANCELLED)
    .map(trip => [trip.dealId, trip]));
  const dockVisits: WarehouseDockVisitValue[] = [];
  const units: WarehouseCargoUnitValue[] = [];
  const yardVisits = new Map<string, WarehouseYardVisitValue>();
  const receiptOrder = new Map<string, { index: number; time: bigint }>();

  for (const task of localTasks) {
    const visit = projectInboundYardVisit(task, deliveryTrips.get(task.dealId));
    const isActive = isWarehouseVisitActive(visit);
    if (hasDock && visit !== undefined) {
      yardVisits.set(task.id, visit);
      if (isActive) {
        dockVisits.push(visit);
      }
    }
    const receipts = new Map(task.receivedUnits.map((unit, index) => {
      const timestamp = unit.receivedAt;
      receiptOrder.set(unit.expectedUnitId, { index, time: (timestamp?.seconds ?? 0n) * 1_000_000_000n + BigInt(timestamp?.nanos ?? 0) });
      return [unit.expectedUnitId, unit] as const;
    }));
    for (const [index, expected] of task.expectedUnits.entries()) {
      const received = receipts.get(expected.id);
      if (received === undefined && !isActive) {
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
        unloadingPointId: visit?.isWaitingInYard === true ? undefined : task.unloadingPointId,
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

  const outbound = options === undefined ? undefined : appendOutboundCargo(options, units, hasDock, yardVisits);
  if (outbound !== undefined) {
    dockVisits.push(...outbound.dockVisits);
  }
  const next = dockVisits.find(visit => visit.unloadingPointId !== undefined)
    ?? dockVisits.find(visit => visit.isWaitingInYard !== true);
  return {
    dockTaskId: next?.taskId,
    dockTripId: next?.tripId,
    dockVisits,
    hasDock,
    shippedUnitIds: outbound?.shippedUnitIds,
    units,
    yardVisits,
  };
};
