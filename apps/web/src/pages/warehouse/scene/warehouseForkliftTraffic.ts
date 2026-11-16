import type { WarehouseForkliftPlaybackValue } from './warehouseForkliftPlayback';

import { isWarehouseForkliftLocalTransfer } from './warehouseForkliftRoute';

const hasStarted = ({ elapsed, phaseIndex }: WarehouseForkliftPlaybackValue): boolean => phaseIndex > 0 || elapsed > 0;

export const canAdvanceWarehouseForklift = (
  lanes: readonly (undefined | WarehouseForkliftPlaybackValue)[],
  laneIndex: number,
): boolean => {
  const lane = lanes[laneIndex];
  const job = lane?.jobs[0];
  if (lane === undefined || job === undefined) {
    return false;
  }

  let waitingShared = -1;
  let hasActiveLocal = false;
  for (let index = 0; index < lanes.length; index += 1) {
    const current = lanes[index];
    const next = current?.jobs[0];
    if (current === undefined || next === undefined) {
      continue;
    }

    const isStarted = hasStarted(current);
    if (isWarehouseForkliftLocalTransfer(next.transfer)) {
      hasActiveLocal ||= isStarted;
    }
    else {
      if (isStarted) {
        return index === laneIndex;
      }
      if (waitingShared === -1) {
        waitingShared = index;
      }
    }
  }

  if (waitingShared === -1) {
    return true;
  }
  if (isWarehouseForkliftLocalTransfer(job.transfer)) {
    return hasStarted(lane);
  }
  return !hasActiveLocal && waitingShared === laneIndex;
};
