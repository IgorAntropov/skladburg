import type {
  NetworkSceneBuildingKindValue,
  NetworkSceneBuildingValue,
} from '../layout';
import type { InstanceTransformValue } from './composeInstanceMatrix';

import {
  hashUnit,
  LAYOUT_SALT,
  lerpRange,
} from '../layout';
import { NETWORK_WORLD_SEED } from '../networkWorldConstants';
import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from './composeInstanceMatrix';
import {
  FLAT_ROOF_THICKNESS_METERS,
  GABLE_ROOF_RISE_METERS,
  PLAZA_HEIGHT_METERS,
  ROOF_TINT_RANGE,
  WALL_TINT_RANGE,
} from './networkSceneMetrics';

export type BuildingPartKeyValue = 'buildingRoof' | 'buildingRoofAlt' | 'buildingWall' | 'warehouseRoof' | 'warehouseWall';

export type BuildingPartShapeValue = 'box' | 'gable';

export interface BuildingPartValue {
  items: readonly NetworkSceneBuildingValue[];
  key: BuildingPartKeyValue;
  matrices: Float32Array;
  shape: BuildingPartShapeValue;
  tints: Float32Array;
}

interface BuildingPartRuleValue {
  key: BuildingPartKeyValue;
  kinds: readonly NetworkSceneBuildingKindValue[];
  shape: BuildingPartShapeValue;
  tint: BuildingPartTintValue | undefined;
  transform: (building: NetworkSceneBuildingValue) => InstanceTransformValue;
}

interface BuildingPartTintValue {
  range: readonly [number, number];
  salt: number;
}

const TINT_ITEM_SIZE = 3;
const WALL_TINT: BuildingPartTintValue = { range: WALL_TINT_RANGE, salt: LAYOUT_SALT.wallTint };
const ROOF_TINT: BuildingPartTintValue = { range: ROOF_TINT_RANGE, salt: LAYOUT_SALT.roofTint };
const QUARTER_TURN = Math.PI / 2;

const getWallHeight = (building: NetworkSceneBuildingValue): number => {
  const roofHeight = building.kind === 'office' ? FLAT_ROOF_THICKNESS_METERS : GABLE_ROOF_RISE_METERS;

  return building.height - roofHeight;
};

const getWallTransform = (building: NetworkSceneBuildingValue): InstanceTransformValue => ({
  rotationY: building.rotation,
  scale: [building.width, getWallHeight(building), building.depth],
  x: building.x,
  y: PLAZA_HEIGHT_METERS,
  z: building.z,
});

const getGableTransform = (building: NetworkSceneBuildingValue): InstanceTransformValue => {
  const isRidgeAlongDepth = building.depth > building.width;

  return {
    rotationY: building.rotation + (isRidgeAlongDepth ? QUARTER_TURN : 0),
    scale: isRidgeAlongDepth
      ? [building.depth, GABLE_ROOF_RISE_METERS, building.width]
      : [building.width, GABLE_ROOF_RISE_METERS, building.depth],
    x: building.x,
    y: PLAZA_HEIGHT_METERS + getWallHeight(building),
    z: building.z,
  };
};

const getSlabTransform = (building: NetworkSceneBuildingValue): InstanceTransformValue => ({
  rotationY: building.rotation,
  scale: [building.width, FLAT_ROOF_THICKNESS_METERS, building.depth],
  x: building.x,
  y: PLAZA_HEIGHT_METERS + getWallHeight(building),
  z: building.z,
});

export const BUILDING_PART_RULES: readonly BuildingPartRuleValue[] = [
  { key: 'buildingWall', kinds: ['house', 'office'], shape: 'box', tint: WALL_TINT, transform: getWallTransform },
  { key: 'warehouseWall', kinds: ['warehouse'], shape: 'box', tint: undefined, transform: getWallTransform },
  { key: 'buildingRoof', kinds: ['house'], shape: 'gable', tint: ROOF_TINT, transform: getGableTransform },
  { key: 'buildingRoofAlt', kinds: ['office'], shape: 'box', tint: ROOF_TINT, transform: getSlabTransform },
  { key: 'warehouseRoof', kinds: ['warehouse'], shape: 'gable', tint: undefined, transform: getGableTransform },
];

const buildPart = (rule: BuildingPartRuleValue, buildings: readonly NetworkSceneBuildingValue[]): BuildingPartValue => {
  const items = buildings.filter(building => rule.kinds.includes(building.kind));
  const matrices = new Float32Array(items.length * INSTANCE_MATRIX_ITEM_SIZE);
  const tints = new Float32Array(items.length * TINT_ITEM_SIZE);

  for (const [index, building] of items.entries()) {
    const tint = rule.tint === undefined ? 1 : lerpRange(rule.tint.range, hashUnit(NETWORK_WORLD_SEED, building.id, rule.tint.salt));

    writeInstanceMatrix(matrices, index, rule.transform(building));
    tints.fill(tint, index * TINT_ITEM_SIZE, (index + 1) * TINT_ITEM_SIZE);
  }

  return { items, key: rule.key, matrices, shape: rule.shape, tints };
};

export const buildBuildingParts = (buildings: readonly NetworkSceneBuildingValue[]): readonly BuildingPartValue[] =>
  BUILDING_PART_RULES.map(rule => buildPart(rule, buildings));
