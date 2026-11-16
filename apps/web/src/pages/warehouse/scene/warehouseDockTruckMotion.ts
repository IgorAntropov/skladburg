export interface WarehouseDockTruckValue {
  elapsed: number;
  offsetZ: number;
  phase: 'approaching' | 'away' | 'departing' | 'docked';
  startZ: number;
  taskId: string | undefined;
}

export const WAREHOUSE_TRUCK_RUNUP = 3.2;
const APPROACH_SECONDS = 1.6;
const DEPARTURE_SECONDS = 1.35;
const MAX_FRAME_DELTA = 0.05;

export const createWarehouseDockTruck = (taskId: string | undefined): WarehouseDockTruckValue => ({
  elapsed: 0,
  offsetZ: taskId === undefined ? -WAREHOUSE_TRUCK_RUNUP : 0,
  phase: taskId === undefined ? 'away' : 'docked',
  startZ: 0,
  taskId,
});

export const isWarehouseDockTruckMoving = ({ phase }: WarehouseDockTruckValue): boolean =>
  phase === 'approaching' || phase === 'departing';

export const syncWarehouseDockTruck = (
  truck: WarehouseDockTruckValue,
  taskId: string | undefined,
  hasConfirmedDeparture: boolean,
  isReducedMotion: boolean,
): void => {
  if (isReducedMotion) {
    truck.offsetZ = taskId === undefined ? -WAREHOUSE_TRUCK_RUNUP : 0;
    truck.phase = taskId === undefined ? 'away' : 'docked';
    truck.taskId = taskId;
    return;
  }
  if (truck.phase === 'departing' || taskId === truck.taskId) {
    return;
  }
  if (hasConfirmedDeparture && truck.taskId !== undefined) {
    truck.elapsed = 0;
    truck.startZ = truck.offsetZ;
    truck.phase = 'departing';
    return;
  }
  if (taskId !== undefined && truck.phase === 'away') {
    truck.elapsed = 0;
    truck.startZ = truck.offsetZ;
    truck.phase = 'approaching';
  }
  else {
    truck.offsetZ = taskId === undefined ? -WAREHOUSE_TRUCK_RUNUP : 0;
    truck.phase = taskId === undefined ? 'away' : 'docked';
  }
  truck.taskId = taskId;
};

export const advanceWarehouseDockTruck = (truck: WarehouseDockTruckValue, delta: number): void => {
  if (!isWarehouseDockTruckMoving(truck)) {
    return;
  }
  const isApproaching = truck.phase === 'approaching';
  const duration = isApproaching ? APPROACH_SECONDS : DEPARTURE_SECONDS;
  const endZ = isApproaching ? 0 : -WAREHOUSE_TRUCK_RUNUP;
  truck.elapsed += Math.min(delta, MAX_FRAME_DELTA);
  const progress = Math.min(truck.elapsed / duration, 1);
  const eased = progress * progress * (3 - 2 * progress);
  truck.offsetZ = truck.startZ + (endZ - truck.startZ) * eased;
  if (progress === 1) {
    truck.phase = isApproaching ? 'docked' : 'away';
    if (!isApproaching) {
      truck.taskId = undefined;
    }
  }
};
