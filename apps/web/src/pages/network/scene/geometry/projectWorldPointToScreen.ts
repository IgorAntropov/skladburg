import type { Camera } from 'three';

import { Vector3 } from 'three';

export interface ScreenPointValue {
  isVisible: boolean;
  x: number;
  y: number;
}

export interface ScreenSizeValue {
  height: number;
  width: number;
}

export interface WorldPointValue {
  x: number;
  y: number;
  z: number;
}

const scratch = new Vector3();

export const createScreenPoint = (): ScreenPointValue => ({ isVisible: false, x: 0, y: 0 });

export const projectWorldPointToScreen = (
  point: WorldPointValue,
  camera: Camera,
  size: ScreenSizeValue,
  out: ScreenPointValue,
): ScreenPointValue => {
  scratch.set(point.x, point.y, point.z).project(camera);

  out.x = ((scratch.x + 1) * size.width) / 2;
  out.y = ((1 - scratch.y) * size.height) / 2;
  out.isVisible = scratch.z > -1 && scratch.z < 1;

  return out;
};
