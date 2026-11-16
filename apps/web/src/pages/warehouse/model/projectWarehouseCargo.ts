import type { Trip } from '@skladburg/contracts/logistics/v1/logistics';
import type { PickingTask } from '@skladburg/contracts/wms/v1/picking';
import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { TripStatus } from '@skladburg/contracts/logistics/v1/trip_records';
import { PickingTaskStatus } from '@skladburg/contracts/wms/v1/picking';
import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';

import type {
  WarehouseCargoUnitValue,
  WarehouseCargoValue,
} from './warehouseSceneCargo';

interface WarehouseCargoProjectionValue {
  picking: readonly PickingTask[] | undefined;
  trips: readonly Trip[] | undefined;
  warehouseId: string;
}

const isAtDock = (task: ReceivingTask): boolean =>
  task.status === ReceivingTaskStatus.OPEN || task.status === ReceivingTaskStatus.IN_PROGRESS;

const appendOutboundCargo = (
  { picking, trips, warehouseId }: WarehouseCargoProjectionValue,
  units: WarehouseCargoUnitValue[],
  hasDock: boolean,
  preferredTaskId: string | undefined,
): Pick<WarehouseCargoValue, 'dockTaskId' | 'dockTripId' | 'shippedUnitIds'> => {
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

  const dockTask = dockTasks.find(task => task.id === preferredTaskId)
    ?? dockTasks.find(task => task.status === PickingTaskStatus.SHIPPED) ?? dockTasks[0];
  return {
    dockTaskId: dockTask?.id,
    dockTripId: dockTask === undefined ? undefined : pickupTrips.get(dockTask.dealId)?.id,
    shippedUnitIds,
  };
};

export const projectWarehouseCargo = (
  tasks: readonly ReceivingTask[],
  areaId: string | undefined,
  hasDock: boolean,
  preferredTaskId: string | undefined,
  options?: WarehouseCargoProjectionValue,
): WarehouseCargoValue => {
  const localTasks = tasks.filter(task => task.receivingAreaId === areaId && task.status !== ReceivingTaskStatus.UNSPECIFIED
    && (options === undefined || task.warehouseId === options.warehouseId));
  const arrived = hasDock ? localTasks.filter(isAtDock) : [];
  const dockTask = arrived.find(task => task.id === preferredTaskId)
    ?? arrived.find(task => task.status === ReceivingTaskStatus.IN_PROGRESS) ?? arrived[0];
  const units: WarehouseCargoUnitValue[] = [];
  const receiptOrder = new Map<string, { index: number; time: bigint }>();

  for (const task of localTasks) {
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

  const outbound = options === undefined ? undefined : appendOutboundCargo(options, units, hasDock, preferredTaskId);
  const dockTripId = dockTask === undefined
    ? outbound?.dockTripId
    : options?.trips?.find(trip =>
      trip.dealId === dockTask.dealId && trip.delivery?.warehouseId === options.warehouseId && trip.status === TripStatus.ARRIVED,
    )?.id;
  return { dockTaskId: dockTask?.id ?? outbound?.dockTaskId, dockTripId, hasDock, shippedUnitIds: outbound?.shippedUnitIds, units };
};
