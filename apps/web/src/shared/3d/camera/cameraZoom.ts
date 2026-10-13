import type {
  CameraViewValue,
  ScenePointValue,
} from './cameraTypes';

import { ZOOM_STEP_FACTOR } from './cameraConstants';

const HOME_ZOOM_TOLERANCE_RATIO = 1e-3;
const HOME_TARGET_TOLERANCE_METERS = 0.01;

export interface IsViewAtHomeOptionsValue {
  home: CameraViewValue;
  target: ScenePointValue;
  zoom: number;
}

export const stepZoom = (zoom: number, direction: -1 | 1): number => zoom * ZOOM_STEP_FACTOR ** direction;

export const isViewAtHome = ({ home, target, zoom }: IsViewAtHomeOptionsValue): boolean => {
  const isZoomAtHome = Math.abs(zoom - home.zoom) <= home.zoom * HOME_ZOOM_TOLERANCE_RATIO;
  const groundDistance = Math.hypot(target.x - home.target.x, target.z - home.target.z);

  return isZoomAtHome && groundDistance <= HOME_TARGET_TOLERANCE_METERS;
};
