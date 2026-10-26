import { INSTANCE_MATRIX_ITEM_SIZE } from './composeInstanceMatrix';
import {
  SITE_MARK_CENTER_HEIGHT_METERS,
  SITE_MARK_HOVER_LIFT_METERS,
  SITE_MARK_HOVER_SCALE,
  SITE_MARK_VERTICAL_STRETCH,
} from './networkSceneMetrics';

export interface QuaternionLikeValue {
  w: number;
  x: number;
  y: number;
  z: number;
}

export const getCameraAzimuth = (rotation: QuaternionLikeValue): number => {
  const backwardX = 2 * (rotation.x * rotation.z + rotation.w * rotation.y);
  const backwardZ = 1 - 2 * (rotation.x * rotation.x + rotation.y * rotation.y);

  return Math.atan2(backwardX, backwardZ);
};

export const applySiteMarkAzimuth = (
  matrices: Float32Array,
  count: number,
  azimuth: number,
  hoverMask: Uint8Array | undefined,
): void => {
  const cosine = Math.cos(azimuth);
  const sine = Math.sin(azimuth);

  for (let index = 0; index < count; index += 1) {
    const offset = index * INSTANCE_MATRIX_ITEM_SIZE;
    const isHovered = hoverMask?.[index] === 1;
    const scale = isHovered ? SITE_MARK_HOVER_SCALE : 1;

    matrices[offset] = cosine * scale;
    matrices[offset + 1] = 0;
    matrices[offset + 2] = -sine * scale;
    matrices[offset + 3] = 0;
    matrices[offset + 4] = 0;
    matrices[offset + 5] = SITE_MARK_VERTICAL_STRETCH * scale;
    matrices[offset + 6] = 0;
    matrices[offset + 7] = 0;
    matrices[offset + 8] = sine * scale;
    matrices[offset + 9] = 0;
    matrices[offset + 10] = cosine * scale;
    matrices[offset + 11] = 0;
    matrices[offset + 13] = isHovered ? SITE_MARK_CENTER_HEIGHT_METERS + SITE_MARK_HOVER_LIFT_METERS : SITE_MARK_CENTER_HEIGHT_METERS;
    matrices[offset + 15] = 1;
  }
};
