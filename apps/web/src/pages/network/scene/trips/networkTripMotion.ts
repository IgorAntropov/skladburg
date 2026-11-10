import type { NetworkTripActorValue } from '../../model/networkTripActor';
import type { NetworkTripPathValue } from './networkTripPath';

export interface NetworkTripPoseValue {
  heading: number;
  progress: number;
  x: number;
  z: number;
}

const PROGRESS_EPSILON = 1e-5;
const CATCH_UP_SECONDS = 0.24;

export const readNetworkTripProgress = (actor: NetworkTripActorValue, worldTimeMs: number): number => {
  if (actor.phase === 'loading') {
    return 0;
  }
  if (actor.phase === 'arrived' || actor.arrivalAtMs <= actor.departureAtMs) {
    return 1;
  }

  return Math.max(0, Math.min(1, (worldTimeMs - actor.departureAtMs) / (actor.arrivalAtMs - actor.departureAtMs)));
};

export const sampleNetworkTripPath = (
  path: NetworkTripPathValue,
  progress: number,
  target: Pick<NetworkTripPoseValue, 'heading' | 'x' | 'z'>,
): void => {
  const distance = path.distance * progress;
  let index = 0;
  let segment = path.segments[index];

  while (segment !== undefined && segment.endDistance < distance) {
    index += 1;
    segment = path.segments[index];
  }

  if (segment === undefined) {
    return;
  }

  const fraction = 1 - (segment.endDistance - distance) / segment.length;

  target.x = segment.from.x + (segment.to.x - segment.from.x) * fraction;
  target.z = segment.from.z + (segment.to.z - segment.from.z) * fraction;
  target.heading = segment.heading;
};

export const advanceNetworkTripPose = (
  actor: NetworkTripActorValue,
  path: NetworkTripPathValue,
  pose: NetworkTripPoseValue,
  worldTimeMs: number,
  deltaSeconds: number,
): boolean => {
  const progress = readNetworkTripProgress(actor, worldTimeMs);
  const difference = progress - pose.progress;
  const shouldEase = actor.phase !== 'loading' && Math.abs(difference) > PROGRESS_EPSILON;

  pose.progress = shouldEase ? pose.progress - difference * Math.expm1(-deltaSeconds / CATCH_UP_SECONDS) : progress;
  sampleNetworkTripPath(path, pose.progress, pose);

  return shouldEase || (actor.phase === 'moving' && progress < 1);
};
