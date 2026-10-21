import { INSTANCE_MATRIX_ITEM_SIZE } from './composeInstanceMatrix';
import { CHIP_VERTICAL_STRETCH } from './networkSceneMetrics';

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

export const applyChipAzimuth = (matrices: Float32Array, count: number, azimuth: number): void => {
  const cosine = Math.cos(azimuth);
  const sine = Math.sin(azimuth);

  for (let index = 0; index < count; index += 1) {
    const offset = index * INSTANCE_MATRIX_ITEM_SIZE;

    matrices[offset] = cosine;
    matrices[offset + 1] = 0;
    matrices[offset + 2] = -sine;
    matrices[offset + 3] = 0;
    matrices[offset + 4] = 0;
    matrices[offset + 5] = CHIP_VERTICAL_STRETCH;
    matrices[offset + 6] = 0;
    matrices[offset + 7] = 0;
    matrices[offset + 8] = sine;
    matrices[offset + 9] = 0;
    matrices[offset + 10] = cosine;
    matrices[offset + 11] = 0;
    matrices[offset + 15] = 1;
  }
};
