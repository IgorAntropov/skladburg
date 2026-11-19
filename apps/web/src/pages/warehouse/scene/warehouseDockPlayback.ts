import type {
  WarehouseCargoValue,
  WarehouseDockDepartureValue,
} from '../model/warehouseSceneCargo';
import type { WarehouseDeparturePalletValue } from './warehouseCargoPositions';
import type { WarehouseDockTruckValue } from './warehouseDockTruckMotion';
import type {
  WarehouseDockPointValue,
  WarehouseLayoutValue,
} from './warehouseLayout';

import { readWarehouseDockDeparture } from '../model/warehouseSceneCargo';
import { buildWarehouseDepartureCargo } from './warehouseCargoPositions';

export interface WarehouseDockStepValue {
  departure: undefined | WarehouseDockDepartureValue;
  hasReachedDock: boolean;
  hasStartedExit: boolean;
  isCatchingUp: boolean;
  load?: readonly WarehouseDeparturePalletValue[] | undefined;
  taskId: string;
  tripId: string | undefined;
}

export interface WarehouseYardPlaybackClockValue {
  delta: number;
  isCatchingUp: boolean;
  isPaused: boolean;
  isResuming: boolean;
}

const MAX_DOCK_STEPS = 3;

export const hasPendingWarehouseDockStep = (steps: readonly WarehouseDockStepValue[], taskId: string | undefined): boolean => {
  let index = 0;
  while (taskId !== undefined && index < steps.length) {
    const step = steps[index];
    if (step?.taskId === taskId && !step.hasStartedExit) {
      return true;
    }
    index += 1;
  }
  return false;
};

export const syncWarehouseDockSteps = (steps: WarehouseDockStepValue[], cargo: WarehouseCargoValue): void => {
  let count = 0;
  for (const step of steps) {
    const visit = cargo.yardVisits?.get(step.taskId);
    if (visit?.tripId !== undefined && step.tripId !== undefined && visit.tripId !== step.tripId) {
      continue;
    }
    step.tripId ??= visit?.tripId;
    step.departure ??= readWarehouseDockDeparture(cargo, step.taskId, step.tripId);
    if (step.departure !== undefined || step.taskId === cargo.dockTaskId) {
      steps[count] = step;
      count += 1;
    }
  }
  steps.length = count;

  const target = cargo.dockTaskId;
  if (target !== undefined && !steps.some(step => step.taskId === target)) {
    if (steps.length === MAX_DOCK_STEPS) {
      steps.length = 1;
    }
    steps.push({
      departure: undefined, hasReachedDock: false, hasStartedExit: false, isCatchingUp: false, taskId: target, tripId: cargo.dockTripId,
    });
  }
};

export const retainWarehouseDockLoads = (
  steps: readonly WarehouseDockStepValue[],
  layout: WarehouseLayoutValue,
  prev: undefined | WarehouseCargoValue,
  shippedUnitIds: ReadonlySet<string> | undefined,
  dock: undefined | WarehouseDockPointValue,
): void => {
  for (const step of steps) {
    if (step.load === undefined && (step.departure === 'route' || step.departure === 'self-pickup')) {
      const load = buildWarehouseDepartureCargo(layout, step.taskId, prev, shippedUnitIds, dock);
      if (load.length > 0) {
        step.load = load;
      }
    }
  }
};

export const advanceWarehouseDockSteps = (
  steps: WarehouseDockStepValue[],
  phase: WarehouseDockTruckValue['phase'],
  taskId: string | undefined,
  hasHandoff: boolean,
): string | undefined => {
  let step = steps[0];
  if (step?.hasStartedExit === true && step.taskId !== taskId) {
    steps.shift();
    step = steps[0];
  }
  if (step === undefined) {
    return undefined;
  }
  if (step.taskId === taskId) {
    step.hasReachedDock ||= phase === 'docked';
    step.hasStartedExit ||= phase === 'departing';
  }
  if (step.departure !== undefined) {
    step.isCatchingUp ||= !step.hasReachedDock || hasHandoff;
    if (step.hasStartedExit || (step.hasReachedDock && !hasHandoff)) {
      return undefined;
    }
  }
  return step.taskId;
};
