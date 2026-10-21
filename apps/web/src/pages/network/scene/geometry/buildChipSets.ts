import type { MapSideValue } from '@/entities/network';

import type { NetworkSceneBuildingValue } from '../layout';

import { applyChipAzimuth } from './chipOrientation';
import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from './composeInstanceMatrix';
import {
  CHIP_CENTER_HEIGHT_METERS,
  CHIP_POST_TOP_METERS,
  CHIP_POST_WIDTH_METERS,
  PLAZA_HEIGHT_METERS,
} from './networkSceneMetrics';
import { NETWORK_SIDES } from './networkSides';

export interface ChipSetsValue {
  postMatrices: Float32Array;
  sets: readonly ChipSetValue[];
}

export interface ChipSetValue {
  count: number;
  matrices: Float32Array;
  side: MapSideValue;
}

export const buildChipSets = (buildings: readonly NetworkSceneBuildingValue[]): ChipSetsValue => {
  const companies = buildings.filter(building => building.isCompany && building.side !== undefined);
  const postMatrices = new Float32Array(companies.length * INSTANCE_MATRIX_ITEM_SIZE);

  for (const [index, building] of companies.entries()) {
    const ridgeHeight = PLAZA_HEIGHT_METERS + building.height;

    writeInstanceMatrix(postMatrices, index, {
      rotationY: 0,
      scale: [CHIP_POST_WIDTH_METERS, Math.max(0, CHIP_POST_TOP_METERS - ridgeHeight), CHIP_POST_WIDTH_METERS],
      x: building.x,
      y: ridgeHeight,
      z: building.z,
    });
  }

  const sets = NETWORK_SIDES.map((side): ChipSetValue => {
    const sideBuildings = companies.filter(building => building.side === side);
    const matrices = new Float32Array(sideBuildings.length * INSTANCE_MATRIX_ITEM_SIZE);

    for (const [index, building] of sideBuildings.entries()) {
      matrices[index * INSTANCE_MATRIX_ITEM_SIZE + 12] = building.x;
      matrices[index * INSTANCE_MATRIX_ITEM_SIZE + 13] = CHIP_CENTER_HEIGHT_METERS;
      matrices[index * INSTANCE_MATRIX_ITEM_SIZE + 14] = building.z;
    }

    applyChipAzimuth(matrices, sideBuildings.length, 0);

    return { count: sideBuildings.length, matrices, side };
  });

  return { postMatrices, sets };
};
