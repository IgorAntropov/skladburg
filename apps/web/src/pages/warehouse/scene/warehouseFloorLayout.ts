import type { WorldPaletteKeyValue } from '@/shared/3d';

import type {
  WarehouseBoxValue,
  WarehouseDockPointValue,
  WarehouseFloorValue,
  WarehouseReceivingLayoutValue,
} from './warehouseLayout';

import { WAREHOUSE_TRUCK_RUNUP } from './warehouseDockTruckMotion';
import {
  readWarehouseParkingOffset,
  WAREHOUSE_YARD_PARKING_LIMIT,
} from './warehouseYardParking';

type BoxLayersValue = Map<WorldPaletteKeyValue, WarehouseBoxValue[]>;
type VectorValue = WarehouseBoxValue['position'];

export const WAREHOUSE_DOCK_LANE_LENGTH = 6.44 + WAREHOUSE_TRUCK_RUNUP;
const DOCK_LANE_WIDTH = 2.5;

export const addWarehouseBox = (
  layers: BoxLayersValue,
  material: WorldPaletteKeyValue,
  position: VectorValue,
  size: VectorValue,
): void => {
  const box = { position, size };
  const batch = layers.get(material);
  if (batch === undefined) {
    layers.set(material, [box]);
  }
  else {
    batch.push(box);
  }
};

const addSlab = (floor: BoxLayersValue, centerX: number, centerZ: number, width: number, depth: number): void => {
  addWarehouseBox(floor, 'road', [centerX, -0.17, centerZ], [width, 0.22, depth]);
  addWarehouseBox(floor, 'warehouseRoof', [centerX, -0.042, centerZ], [width, 0.036, depth]);
};

const addFloorJoints = (floor: BoxLayersValue, { depth, width, x, z }: WarehouseFloorValue): void => {
  const jointSpacing = 1.65;
  const maxDivisions = 31;
  const columns = Math.min(maxDivisions, Math.ceil(width / jointSpacing));
  const rows = Math.min(maxDivisions, Math.ceil(depth / jointSpacing));

  for (let column = 1; column < columns; column += 1) {
    addWarehouseBox(floor, 'plaza', [x + column * width / columns, 0.004, z + depth / 2], [0.019, 0.008, depth]);
  }
  for (let row = 1; row < rows; row += 1) {
    addWarehouseBox(floor, 'plaza', [x + width / 2, 0.005, z + row * depth / rows], [width, 0.008, 0.019]);
  }
};

const addWall = (floor: BoxLayersValue, x: number, z: number, width: number, depth: number): void => {
  addWarehouseBox(floor, 'warehouseRoof', [x, 0.06, z], [width + 0.035, 0.12, depth + 0.035]);
  addWarehouseBox(floor, 'warehouseWall', [x, 0.54, z], [width, 1.08, depth]);
  addWarehouseBox(floor, 'windowGlass', [x, 1.09, z], [width + 0.06, 0.075, depth + 0.06]);
};

const addFacade = (floor: BoxLayersValue, x: number, z: number, width: number, docks: readonly WarehouseDockPointValue[]): void => {
  const dockGap = 1.12;
  let start = x;

  for (const dock of docks.toSorted((first, second) => first.x - second.x)) {
    const span = dock.x - dockGap - start;
    if (span > 0.18) {
      addWall(floor, start + span / 2, z, span, 0.16);
    }
    start = Math.max(start, dock.x + dockGap);
  }

  const span = x + width - start;
  if (span > 0.18) {
    addWall(floor, start + span / 2, z, span, 0.16);
  }
};

const addReceivingMarks = (
  floor: BoxLayersValue,
  { depth, width, x, z }: WarehouseReceivingLayoutValue,
): void => {
  addWarehouseBox(floor, 'warehouseRoof', [x + width / 2, 0.019, z + depth / 2], [width, 0.038, depth]);
  for (const edge of [x, x + width]) {
    addWarehouseBox(floor, 'buildingRoofAlt', [edge, 0.04, z + depth / 2], [0.055, 0.018, depth]);
  }
  addWarehouseBox(floor, 'buildingRoofAlt', [x + width / 2, 0.04, z + depth], [width, 0.018, 0.055]);

  const stripes = Math.min(8, Math.floor(width / 0.23));
  for (let index = 0; index < stripes; index += 1) {
    const stripeX = x + (index + 0.5) * width / stripes;

    addWarehouseBox(floor, 'sand', [stripeX, 0.041, z + 0.08], [width / stripes * 0.45, 0.014, Math.min(0.13, depth / 4)]);
  }
};

const addDock = (floor: BoxLayersValue, { x, z }: WarehouseDockPointValue): void => {
  addWarehouseBox(floor, 'road', [x, 0.01, z - WAREHOUSE_DOCK_LANE_LENGTH / 2], [DOCK_LANE_WIDTH, 0.02, WAREHOUSE_DOCK_LANE_LENGTH]);
  addWarehouseBox(floor, 'warehouseRoof', [x, 0.16, z + 0.18], [1.86, 0.32, 0.65]);
  addWarehouseBox(floor, 'windowGlass', [x, 2.32, z], [2.16, 0.2, 0.24]);
  addWarehouseBox(floor, 'warehouseRoof', [x, 2.45, z], [2.32, 0.09, 0.35]);
  for (const offset of [-1.02, 1.02]) {
    addWarehouseBox(floor, 'windowGlass', [x + offset, 1.1, z], [0.2, 2.2, 0.24]);
    addWarehouseBox(floor, 'lampGlow', [x + offset, 2.17, z - 0.13], [0.12, 0.11, 0.03]);
    addWarehouseBox(floor, 'buildingRoofAlt', [x + offset * 1.12, 0.32, z - 0.3], [0.11, 0.64, 0.11]);
    for (let index = 0; index < Math.floor(WAREHOUSE_DOCK_LANE_LENGTH); index += 1) {
      addWarehouseBox(floor, 'sand', [x + offset * 1.28, 0.025, z - 0.6 - index], [0.045, 0.02, 0.55]);
    }
  }
};

const addParking = (
  floor: BoxLayersValue,
  { x, z }: WarehouseDockPointValue,
  docks: readonly WarehouseDockPointValue[],
  slabStartZ: number,
): void => {
  const spacing = readWarehouseParkingOffset(0) - readWarehouseParkingOffset(1);
  const laneStartZ = z - WAREHOUSE_DOCK_LANE_LENGTH;
  const laneLength = WAREHOUSE_YARD_PARKING_LIMIT * spacing;
  const laneCenterZ = laneStartZ - laneLength / 2;
  let left = x;
  let right = x;
  for (const dock of docks) {
    left = Math.min(left, dock.x);
    right = Math.max(right, dock.x);
  }
  const centerX = (left + right) / 2;
  const pavementWidth = right - left + DOCK_LANE_WIDTH;
  const apronStartZ = laneStartZ - laneLength - 0.65;
  const apronDepth = slabStartZ - apronStartZ;

  if (apronDepth > 0) {
    const apronWidth = right - left + 4.8;
    const apronCenterZ = apronStartZ + apronDepth / 2;

    addSlab(floor, centerX, apronCenterZ, apronWidth, apronDepth);
    addWarehouseBox(floor, 'plaza', [centerX, -0.012, apronCenterZ], [apronWidth, 0.024, apronDepth]);
  }

  addWarehouseBox(floor, 'road', [centerX, 0.01, laneCenterZ], [pavementWidth, 0.02, laneLength]);
  const edgeInset = DOCK_LANE_WIDTH / 2 - 0.09;
  for (const sideX of [left - edgeInset, right + edgeInset]) {
    addWarehouseBox(floor, 'sand', [sideX, 0.027, laneCenterZ], [0.064, 0.014, laneLength]);
  }
  for (let index = 0; index <= WAREHOUSE_YARD_PARKING_LIMIT; index += 1) {
    const lineZ = laneStartZ - index * spacing;
    addWarehouseBox(floor, 'sand', [x, 0.028, lineZ], [DOCK_LANE_WIDTH - 0.18, 0.014, 0.064]);
  }
};

export const buildWarehouseFloor = (
  { depth, width, x, z }: WarehouseFloorValue,
  receiving: undefined | WarehouseReceivingLayoutValue,
  aisleMarks: readonly WarehouseBoxValue[],
  padding: number,
): ReadonlyMap<WorldPaletteKeyValue, readonly WarehouseBoxValue[]> => {
  const floor: BoxLayersValue = new Map();
  const docks = receiving?.docks ?? [];
  const dock = docks[0];
  const backWallZ = dock === undefined ? z : Math.max(z, Math.min(dock.z, z + depth));
  const indoorDepth = z + depth - backWallZ;
  const centerX = x + width / 2;
  const centerZ = z + depth / 2;

  addWarehouseBox(floor, 'ground', [centerX, -0.33, centerZ], [width + 2 * padding, 0.1, depth + 2 * padding]);
  addSlab(floor, centerX, centerZ, width, depth);
  if (backWallZ > z) {
    const outdoorDepth = backWallZ - z;
    addWarehouseBox(floor, 'plaza', [centerX, -0.012, z + outdoorDepth / 2], [width, 0.024, outdoorDepth]);
  }

  if (indoorDepth > 0) {
    addWarehouseBox(floor, 'warehouseWall', [centerX, -0.012, backWallZ + indoorDepth / 2], [width, 0.024, indoorDepth]);
    addFloorJoints(floor, { depth: indoorDepth, width, x, z: backWallZ });
    addWall(floor, x + 0.08, backWallZ + indoorDepth / 2, 0.16, indoorDepth);
  }

  addFacade(floor, x, backWallZ, width, docks);
  for (const point of docks) {
    addDock(floor, point);
  }
  if (dock !== undefined) {
    addParking(floor, dock, docks, z);
  }

  if (receiving !== undefined) {
    addReceivingMarks(floor, receiving);
  }

  floor.set('sideRim', [...aisleMarks]);
  return floor;
};
