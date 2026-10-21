import type { NetworkSceneCityValue } from '../layout';

import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from './composeInstanceMatrix';
import { PLAZA_HEIGHT_METERS } from './networkSceneMetrics';

export const buildPlazaMatrices = (cities: readonly Pick<NetworkSceneCityValue, 'radius' | 'x' | 'z'>[]): Float32Array => {
  const matrices = new Float32Array(cities.length * INSTANCE_MATRIX_ITEM_SIZE);

  for (const [index, city] of cities.entries()) {
    writeInstanceMatrix(matrices, index, {
      rotationY: 0,
      scale: [city.radius, PLAZA_HEIGHT_METERS, city.radius],
      x: city.x,
      y: 0,
      z: city.z,
    });
  }

  return matrices;
};
