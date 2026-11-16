import type { WarehouseCargoTransferValue } from './warehouseCargoPositions';
import type {
  WarehouseForkliftJobValue,
  WarehouseForkliftPoseValue,
} from './warehouseForkliftRoute';
import type { WarehouseLayoutValue } from './warehouseLayout';

import {
  findWarehouseForkliftParking,
  planWarehouseForkliftJob,
} from './warehouseForkliftRoute';

export interface WarehouseForkliftPlaybackValue {
  elapsed: number;
  jobs: WarehouseForkliftJobValue[];
  parking: undefined | WarehouseForkliftPoseValue;
  phaseIndex: number;
  pose: undefined | WarehouseForkliftPoseValue;
}

export const MAX_WAREHOUSE_FORKLIFT_JOBS = 8;

const MAX_FRAME_DELTA = 1 / 25;

const interpolate = (from: number, to: number, progress: number): number => from + (to - from) * progress;

export const createWarehouseForkliftPlayback = (
  layout: WarehouseLayoutValue, dock = layout.receiving?.dock,
): WarehouseForkliftPlaybackValue => {
  const pose = findWarehouseForkliftParking(layout, dock);
  const hasMultipleDocks = (layout.receiving?.docks.length ?? 0) > 1;

  return {
    elapsed: 0, jobs: [], parking: hasMultipleDocks && pose !== undefined ? { ...pose } : undefined, phaseIndex: 0, pose,
  };
};

export const clearWarehouseForkliftJobs = (playback: WarehouseForkliftPlaybackValue): void => {
  playback.jobs.length = 0;
  playback.elapsed = 0;
  playback.phaseIndex = 0;
  if (playback.pose !== undefined && playback.parking !== undefined) {
    Object.assign(playback.pose, playback.parking);
  }
  else if (playback.pose !== undefined) {
    playback.pose.lift = 0;
    playback.pose.reach = 0;
  }
};

export const queueWarehouseForkliftJobs = (
  playback: WarehouseForkliftPlaybackValue,
  layout: WarehouseLayoutValue,
  transfers: readonly WarehouseCargoTransferValue[],
): void => {
  if (playback.jobs.length + transfers.length > MAX_WAREHOUSE_FORKLIFT_JOBS) {
    clearWarehouseForkliftJobs(playback);
    return;
  }

  for (const transfer of transfers) {
    const start = playback.jobs.at(-1)?.finish ?? playback.pose;
    const job = start === undefined ? undefined : planWarehouseForkliftJob(layout, { ...start }, transfer, playback.parking);
    if (job === undefined) {
      clearWarehouseForkliftJobs(playback);
      return;
    }
    playback.jobs.push(job);
  }
};

export const advanceWarehouseForklift = (playback: WarehouseForkliftPlaybackValue, delta: number, stopAfterJob = false): void => {
  const { pose } = playback;
  if (pose === undefined) {
    return;
  }

  playback.elapsed += Math.min(delta, MAX_FRAME_DELTA);
  while (playback.jobs.length > 0) {
    const phase = playback.jobs[0]?.phases[playback.phaseIndex];
    if (phase === undefined) {
      playback.jobs.shift();
      playback.phaseIndex = 0;
      if (stopAfterJob) {
        playback.elapsed = 0;
        return;
      }
      continue;
    }

    const progress = Math.min(1, playback.elapsed / phase.seconds);
    const eased = progress * progress * (3 - 2 * progress);
    pose.x = interpolate(phase.from.x, phase.to.x, eased);
    pose.z = interpolate(phase.from.z, phase.to.z, eased);
    pose.yaw = interpolate(phase.from.yaw, phase.to.yaw, eased);
    pose.lift = interpolate(phase.from.lift, phase.to.lift, eased);
    pose.reach = interpolate(phase.from.reach, phase.to.reach, eased);

    if (progress < 1) {
      return;
    }
    playback.elapsed -= phase.seconds;
    playback.phaseIndex += 1;
  }
  playback.elapsed = 0;
};
