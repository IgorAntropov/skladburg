import type { ReceivingTask } from '@skladburg/contracts/wms/v1/receiving';

import { ReceivingTaskStatus } from '@skladburg/contracts/wms/v1/receiving';

import type {
  WarehouseCargoUnitValue,
  WarehouseCargoValue,
} from './warehouseSceneCargo';

const isAtDock = (task: ReceivingTask): boolean =>
  task.status === ReceivingTaskStatus.OPEN || task.status === ReceivingTaskStatus.IN_PROGRESS;

export const projectWarehouseCargo = (
  tasks: readonly ReceivingTask[],
  areaId: string | undefined,
  hasDock: boolean,
  preferredTaskId: string | undefined,
): WarehouseCargoValue => {
  const localTasks = tasks.filter(task => task.receivingAreaId === areaId && task.status !== ReceivingTaskStatus.UNSPECIFIED);
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

  return { dockTaskId: dockTask?.id, hasDock, units };
};
