import type {
  CameraFitValue,
  ScenePointValue,
} from './cameraTypes';

import {
  MAX_ZOOM_FACTOR,
  ZOOM_STEP_FACTOR,
} from './cameraConstants';

const FIT_ZOOM_TOLERANCE_RATIO = 1e-3;
const FIT_TARGET_TOLERANCE_METERS = 0.01;

export interface IsViewAtFitOptionsValue {
  fit: CameraFitValue;
  target: ScenePointValue;
  zoom: number;
}

export interface ZoomLimitsValue {
  max: number;
  min: number;
}

export const getZoomLimits = (fitZoom: number): ZoomLimitsValue => ({
  max: fitZoom * MAX_ZOOM_FACTOR,
  min: fitZoom,
});

export const stepZoom = (zoom: number, direction: -1 | 1): number => zoom * ZOOM_STEP_FACTOR ** direction;

export const isViewAtFit = ({ fit, target, zoom }: IsViewAtFitOptionsValue): boolean => {
  const isZoomAtFit = Math.abs(zoom - fit.zoom) <= fit.zoom * FIT_ZOOM_TOLERANCE_RATIO;
  const groundDistance = Math.hypot(target.x - fit.target.x, target.z - fit.target.z);

  return isZoomAtFit && groundDistance <= FIT_TARGET_TOLERANCE_METERS;
};
