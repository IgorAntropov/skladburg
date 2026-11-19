import type {
  WarehouseYardDockChoiceValue,
  WarehouseYardDragOptionsValue,
} from '../model/warehouseYardDockChoice';
import type {
  WarehouseDockLayoutValue,
  WarehouseDockPointValue,
} from './warehouseLayout';

import { WAREHOUSE_TRUCK_CENTER_Z } from './warehouseYardRoads';

export interface WarehouseYardGrabValue extends WarehouseYardPointerValue {
  taskId: string;
  taskVersion: number;
}

type WarehouseYardPointerValue = Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerId'>;

export const WAREHOUSE_YARD_TARGET_HALF_WIDTH = 1.12;
export const WAREHOUSE_YARD_TARGET_HALF_DEPTH = 1.75;
export const WAREHOUSE_YARD_TARGET_HEIGHT = 0.055;
export const WAREHOUSE_YARD_TARGET_OFFSET_Z = WAREHOUSE_TRUCK_CENTER_Z;
const DRAG_SLOP_PX = 5;

export const beginWarehouseYardGrab = (
  parked: readonly { taskId: string }[],
  instanceId: number | undefined,
  options: WarehouseYardDragOptionsValue,
  { clientX, clientY, pointerId }: WarehouseYardPointerValue,
): undefined | WarehouseYardGrabValue => {
  const taskId = instanceId === undefined ? undefined : parked[instanceId]?.taskId;
  if (taskId === undefined) {
    return undefined;
  }
  const option = options.get(taskId);
  return option === undefined || option.unloadingPointIds.length === 0
    ? undefined
    : { clientX, clientY, pointerId, taskId, taskVersion: option.taskVersion };
};

export const readWarehouseYardGrabDocks = (
  { taskId, taskVersion }: WarehouseYardGrabValue,
  options: WarehouseYardDragOptionsValue,
): readonly string[] | undefined => {
  const option = options.get(taskId);
  return option?.taskVersion === taskVersion && option.unloadingPointIds.length > 0 ? option.unloadingPointIds : undefined;
};

export const readWarehouseYardDrop = (
  grab: WarehouseYardGrabValue,
  { clientX, clientY, pointerId }: WarehouseYardPointerValue,
  options: WarehouseYardDragOptionsValue,
  dockId: string | undefined,
): undefined | WarehouseYardDockChoiceValue =>
  pointerId === grab.pointerId && dockId !== undefined
  && Math.hypot(grab.clientX - clientX, grab.clientY - clientY) > DRAG_SLOP_PX
  && readWarehouseYardGrabDocks(grab, options)?.includes(dockId) === true
    ? { taskId: grab.taskId, taskVersion: grab.taskVersion, unloadingPointId: dockId }
    : undefined;

export const findWarehouseYardDockTarget = (
  docks: readonly WarehouseDockLayoutValue[],
  { x, z }: WarehouseDockPointValue,
): string | undefined =>
  docks.find(dock => Math.abs(dock.x - x) <= WAREHOUSE_YARD_TARGET_HALF_WIDTH
    && Math.abs(dock.z + WAREHOUSE_YARD_TARGET_OFFSET_Z - z) <= WAREHOUSE_YARD_TARGET_HALF_DEPTH)?.id;
