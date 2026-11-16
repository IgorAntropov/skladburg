export interface WarehouseDockTruckValue {
  approachSeconds: number;
  elapsed: number;
  offsetX: number;
  offsetZ: number;
  phase: 'approaching' | 'away' | 'departing' | 'docked';
  startX: number;
  startZ: number;
  taskId: string | undefined;
}

export const WAREHOUSE_TRUCK_RUNUP = 3.2;
export const WAREHOUSE_YARD_ADVANCE_SECONDS = 2.8;
const APPROACH_SECONDS = 1.6;
const DEPARTURE_SECONDS = 1.35;
const MAX_FRAME_DELTA = 0.05;

export const createWarehouseDockTruck = (taskId: string | undefined): WarehouseDockTruckValue => ({
  approachSeconds: APPROACH_SECONDS,
  elapsed: 0,
  offsetX: 0,
  offsetZ: taskId === undefined ? -WAREHOUSE_TRUCK_RUNUP : 0,
  phase: taskId === undefined ? 'away' : 'docked',
  startX: 0,
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
  parkingOffsetZ?: number,
  parkingOffsetX = 0,
): void => {
  if (isReducedMotion) {
    truck.offsetX = 0;
    truck.offsetZ = taskId === undefined ? -WAREHOUSE_TRUCK_RUNUP : 0;
    truck.phase = taskId === undefined ? 'away' : 'docked';
    truck.taskId = taskId;
    return;
  }
  if (truck.phase === 'departing' || taskId === truck.taskId) {
    return;
  }
  if (hasConfirmedDeparture && truck.taskId !== undefined && truck.offsetZ > -WAREHOUSE_TRUCK_RUNUP) {
    truck.elapsed = 0;
    truck.startX = truck.offsetX;
    truck.startZ = truck.offsetZ;
    truck.phase = 'departing';
    return;
  }
  if (taskId !== undefined && (truck.phase === 'away' || parkingOffsetZ !== undefined)) {
    truck.approachSeconds = parkingOffsetZ === undefined ? APPROACH_SECONDS : WAREHOUSE_YARD_ADVANCE_SECONDS;
    truck.elapsed = 0;
    truck.offsetX = parkingOffsetZ === undefined ? 0 : parkingOffsetX;
    truck.offsetZ = parkingOffsetZ ?? truck.offsetZ;
    truck.startX = truck.offsetX;
    truck.startZ = truck.offsetZ;
    truck.phase = 'approaching';
  }
  else {
    truck.offsetX = 0;
    truck.offsetZ = taskId === undefined ? -WAREHOUSE_TRUCK_RUNUP : 0;
    truck.phase = taskId === undefined ? 'away' : 'docked';
  }
  truck.taskId = taskId;
};

const ease = (progress: number): number => progress * progress * (3 - 2 * progress);

export const advanceWarehouseDockTruck = (truck: WarehouseDockTruckValue, delta: number): void => {
  if (!isWarehouseDockTruckMoving(truck)) {
    return;
  }
  const isApproaching = truck.phase === 'approaching';
  const duration = isApproaching ? truck.approachSeconds : DEPARTURE_SECONDS;
  const endZ = isApproaching ? 0 : -WAREHOUSE_TRUCK_RUNUP;
  truck.elapsed += Math.min(delta, MAX_FRAME_DELTA);
  const progress = Math.min(truck.elapsed / duration, 1);
  const sideProgress = truck.startX === 0 ? 1 : Math.min(progress / 0.34, 1);
  const forwardProgress = truck.startX === 0 ? progress : Math.max(0, (progress - 0.34) / 0.66);
  truck.offsetX = truck.startX * (1 - ease(sideProgress));
  truck.offsetZ = truck.startZ + (endZ - truck.startZ) * ease(forwardProgress);
  if (progress === 1) {
    truck.phase = isApproaching ? 'docked' : 'away';
    if (!isApproaching) {
      truck.taskId = undefined;
    }
  }
};
