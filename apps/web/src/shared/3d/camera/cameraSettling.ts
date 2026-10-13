import { MAX_FRAME_DELTA_S } from './cameraConstants';

const SETTLE_ANGLE_RADIANS = 1e-3;
const SETTLE_ZOOM_RATIO = 1e-3;
const SETTLE_DISTANCE_METERS = 3e-3;
const MIN_VIEW_HEIGHT_RATIO = 1e-6;
const GROUND_DRIFT_METERS = 1e-6;

export interface GroundShiftOffsetValue {
  phi: number;
  radius: number;
  theta: number;
}

export interface MutablePointValue {
  x: number;
  y: number;
  z: number;
}

export const limitFrameDelta = (delta: number): number => Math.min(Math.max(delta, 0), MAX_FRAME_DELTA_S);

export const isAngleSettled = (current: number, end: number): boolean => Math.abs(end - current) <= SETTLE_ANGLE_RADIANS;

export const isZoomSettled = (current: number, end: number): boolean => {
  return Math.abs(end - current) <= Math.abs(end) * SETTLE_ZOOM_RATIO;
};

export const isPointSettled = (current: MutablePointValue, end: MutablePointValue): boolean => {
  return Math.hypot(end.x - current.x, end.y - current.y, end.z - current.z) <= SETTLE_DISTANCE_METERS;
};

export const shiftPointToGround = (
  point: MutablePointValue,
  offset: GroundShiftOffsetValue,
  groundHeight: number,
): void => {
  const offsetHeight = offset.radius * Math.cos(offset.phi);
  const drift = groundHeight - point.y;

  if (Math.abs(drift) <= GROUND_DRIFT_METERS || Math.abs(offsetHeight) <= offset.radius * MIN_VIEW_HEIGHT_RATIO) {
    return;
  }

  const shift = drift / offsetHeight;
  const horizontalRadius = offset.radius * Math.sin(offset.phi);

  point.x += shift * horizontalRadius * Math.sin(offset.theta);
  point.y = groundHeight;
  point.z += shift * horizontalRadius * Math.cos(offset.theta);
};
