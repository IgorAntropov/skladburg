import type { WorldPaletteKeyValue } from '@/shared/3d';

import type {
  WarehouseBoxValue,
  WarehouseDockPointValue,
  WarehouseFloorValue,
  WarehouseReceivingLayoutValue,
} from './warehouseLayout';
import type { WarehouseYardRoadsValue } from './warehouseYardRoads';

import warehouseShell from './warehouseShell.json';
import {
  WAREHOUSE_YARD_PARKING_LIMIT,
  WAREHOUSE_YARD_PARKING_SPACING,
} from './warehouseYardParking';
import { WAREHOUSE_TRUCK_RUNUP } from './warehouseYardRoads';

type BoxLayersValue = Map<WorldPaletteKeyValue, WarehouseBoxValue[]>;
type ShellValue = Partial<Record<WorldPaletteKeyValue, number[][]>>;
type VectorValue = WarehouseBoxValue['position'];

export const WAREHOUSE_DOCK_LANE_LENGTH = 6.44 + WAREHOUSE_TRUCK_RUNUP;
const DOCK_LANE_WIDTH = 2.5;
const TRUCK_LENGTH = 6.1;
const TRANSFER_MARGIN = 2.7;
const WALL_PANEL_WIDTH = 4;
const MAX_WALL_PANELS = 12;
const MILLIMETERS = 1000;
const SHELL_MATERIALS = ['buildingRoofAlt', 'road', 'warehouseRoof', 'warehouseWall', 'windowGlass'] as const;

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

const addShell = (floor: BoxLayersValue, shell: ShellValue, x: number, z: number, scale = 1, isSide = false): void => {
  for (const key of SHELL_MATERIALS) {
    for (const [partX = 0, y = 0, partZ = 0, width = 0, height = 0, depth = 0] of shell[key] ?? []) {
      const offset = partX * scale;
      const span = width * scale;
      addWarehouseBox(floor, key, [
        x + (isSide ? partZ : offset) / MILLIMETERS,
        y / MILLIMETERS,
        z + (isSide ? offset : partZ) / MILLIMETERS,
      ], [
        (isSide ? depth : span) / MILLIMETERS,
        height / MILLIMETERS,
        (isSide ? span : depth) / MILLIMETERS,
      ]);
    }
  }
};

const addWall = (floor: BoxLayersValue, x: number, z: number, length: number, isSide = false): void => {
  const count = Math.min(MAX_WALL_PANELS, Math.ceil(length / WALL_PANEL_WIDTH));
  const span = length / count;

  for (let index = 0; index < count; index += 1) {
    const offset = (index + 0.5) * span - length / 2;
    const scale = (span - Math.min(span / 24, 0.018)) / WALL_PANEL_WIDTH;

    addShell(floor, warehouseShell.wall, x + (isSide ? 0 : offset), z + (isSide ? offset : 0), scale, isSide);
  }
};

const addSideWalkway = (floor: BoxLayersValue, x: number, z: number, depth: number): void => {
  const endInset = 0.22;
  const length = depth - 2 * endInset;
  if (length <= 0) {
    return;
  }

  const centerZ = z + depth / 2;
  addWarehouseBox(floor, 'plaza', [x + 0.62, 0.01, centerZ], [0.78, 0.004, length]);
  addWarehouseBox(floor, 'buildingRoofAlt', [x + 1.01, 0.013, centerZ], [0.042, 0.004, length]);
};

const addFacade = (floor: BoxLayersValue, x: number, z: number, width: number, docks: readonly WarehouseDockPointValue[]): void => {
  const dockGap = 1.12;
  let start = x;

  for (const dock of docks.toSorted((first, second) => first.x - second.x)) {
    const span = dock.x - dockGap - start;
    if (span > 0.18) {
      addWall(floor, start + span / 2, z, span);
    }
    start = Math.max(start, dock.x + dockGap);
  }

  const span = x + width - start;
  if (span > 0.18) {
    addWall(floor, start + span / 2, z, span);
  }
};

const addReceivingMarks = (
  floor: BoxLayersValue,
  { depth, width, x, z }: WarehouseReceivingLayoutValue,
): void => {
  addWarehouseBox(floor, 'plaza', [x + width / 2, 0.019, z + depth / 2], [width, 0.038, depth]);
  for (const edge of [x, x + width]) {
    addWarehouseBox(floor, 'buildingRoofAlt', [edge, 0.043, z + depth / 2], [0.052, 0.01, depth]);
  }
  addWarehouseBox(floor, 'buildingRoofAlt', [x + width / 2, 0.043, z + depth], [width, 0.01, 0.052]);

  const stripes = Math.min(14, Math.floor(width / 0.24));
  for (let index = 0; index < stripes; index += 1) {
    const stripeX = x + (index + 0.5) * width / stripes;

    addWarehouseBox(floor, 'sand', [stripeX, 0.043, z + Math.min(0.12, depth / 4)], [
      width / stripes * 0.56, 0.01, Math.min(0.18, depth / 3),
    ]);
  }
};

const addDock = (floor: BoxLayersValue, { x, z }: WarehouseDockPointValue): void => {
  addWarehouseBox(floor, 'road', [x, 0.01, z - WAREHOUSE_DOCK_LANE_LENGTH / 2], [DOCK_LANE_WIDTH, 0.02, WAREHOUSE_DOCK_LANE_LENGTH]);
  addShell(floor, warehouseShell.dock, x, z);

  for (const direction of [-1, 1]) {
    addWarehouseBox(floor, 'lampGlow', [x + direction * 1.18, 2.1, z - 0.52], [0.085, 0.1, 0.023]);
    for (let index = 0; index < Math.floor(WAREHOUSE_DOCK_LANE_LENGTH); index += 1) {
      addWarehouseBox(floor, 'sand', [x + direction * 1.2, 0.023, z - 0.6 - index], [0.048, 0.013, 0.55]);
    }
  }
};

const addApron = (floor: BoxLayersValue, x: number, z: number, width: number, depth: number): void => {
  if (width > 0 && depth > 0) {
    addSlab(floor, x + width / 2, z + depth / 2, width, depth);
    addWarehouseBox(floor, 'plaza', [x + width / 2, -0.012, z + depth / 2], [width, 0.024, depth]);
  }
};

const addParking = (
  floor: BoxLayersValue,
  { x, z }: WarehouseDockPointValue,
  docks: readonly WarehouseDockPointValue[],
  yard: WarehouseYardRoadsValue,
  slab: WarehouseFloorValue,
): void => {
  const spacing = WAREHOUSE_YARD_PARKING_SPACING;
  const laneStartZ = z + yard.junctionZ - TRUCK_LENGTH;
  const laneLength = WAREHOUSE_YARD_PARKING_LIMIT * spacing;
  const entranceX = x + yard.entrance.x;
  let right = x;
  for (const dock of docks) {
    right = Math.max(right, dock.x);
  }
  const centerX = (entranceX + right) / 2;
  const pavementWidth = right - entranceX + TRANSFER_MARGIN * 2;
  const apronStartZ = laneStartZ - laneLength - spacing;
  const apronWidth = pavementWidth + 0.6;
  const apronLeft = centerX - apronWidth / 2;
  const apronRight = centerX + apronWidth / 2;
  const transferEndZ = z - WAREHOUSE_DOCK_LANE_LENGTH;
  const approachDepth = transferEndZ - slab.z;
  addApron(floor, apronLeft, apronStartZ, apronWidth, slab.z - apronStartZ);
  addApron(floor, apronLeft, slab.z, slab.x - apronLeft, approachDepth);
  addApron(floor, slab.x + slab.width, slab.z, apronRight - slab.x - slab.width, approachDepth);
  for (const laneX of [x, entranceX]) {
    addWarehouseBox(floor, 'road', [laneX, 0.01, (apronStartZ + laneStartZ) / 2], [DOCK_LANE_WIDTH, 0.02, laneLength + spacing]);
  }
  addWarehouseBox(floor, 'road', [centerX, 0.01, (laneStartZ + transferEndZ) / 2],
    [pavementWidth, 0.02, transferEndZ - laneStartZ]);
  const curbLength = transferEndZ - apronStartZ - 0.2;
  for (const curbX of [apronLeft + 0.11, apronRight - 0.11]) {
    addWarehouseBox(floor, 'warehouseRoof', [curbX, 0.041, apronStartZ + 0.1 + curbLength / 2], [0.13, 0.082, curbLength]);
  }
  for (let markZ = apronStartZ + 0.9; markZ < laneStartZ - 0.6; markZ += 2.4) {
    addWarehouseBox(floor, 'sand', [entranceX, 0.024, markZ], [0.051, 0.008, 0.76]);
  }
  const edgeInset = DOCK_LANE_WIDTH / 2 - 0.09;
  for (const sideX of [x - edgeInset, x + edgeInset]) {
    addWarehouseBox(floor, 'sand', [sideX, 0.027, laneStartZ - laneLength / 2], [0.064, 0.014, laneLength]);
  }
  for (let index = 0; index <= WAREHOUSE_YARD_PARKING_LIMIT; index += 1) {
    const lineZ = laneStartZ - index * spacing;
    addWarehouseBox(floor, 'sand', [x, 0.028, lineZ], [DOCK_LANE_WIDTH - 0.18, 0.014, 0.064]);
  }
};

export const buildWarehouseFloor = (
  framing: WarehouseFloorValue,
  receiving: undefined | WarehouseReceivingLayoutValue,
  yard: undefined | WarehouseYardRoadsValue,
  aisleMarks: readonly WarehouseBoxValue[],
  padding: number,
  { depth, width, x, z }: WarehouseFloorValue = framing,
): ReadonlyMap<WorldPaletteKeyValue, readonly WarehouseBoxValue[]> => {
  const floor: BoxLayersValue = new Map();
  const docks = receiving?.docks ?? [];
  const dock = docks[0];
  const backWallZ = dock === undefined ? z : Math.max(z, Math.min(dock.z, z + depth));
  const indoorDepth = z + depth - backWallZ;
  const centerX = x + width / 2;
  const centerZ = z + depth / 2;

  addWarehouseBox(floor, 'ground', [framing.x + framing.width / 2, -0.33, framing.z + framing.depth / 2], [
    framing.width + 2 * padding, 0.1, framing.depth + 2 * padding,
  ]);
  addSlab(floor, centerX, centerZ, width, depth);
  if (backWallZ > z) {
    const outdoorDepth = backWallZ - z;
    addWarehouseBox(floor, 'plaza', [centerX, -0.012, z + outdoorDepth / 2], [width, 0.024, outdoorDepth]);
  }

  if (indoorDepth > 0) {
    addWarehouseBox(floor, 'warehouseWall', [centerX, -0.012, backWallZ + indoorDepth / 2], [width, 0.024, indoorDepth]);
    addFloorJoints(floor, { depth: indoorDepth, width, x, z: backWallZ });
    addWall(floor, x + 0.12, backWallZ + indoorDepth / 2, indoorDepth, true);
    addSideWalkway(floor, x, backWallZ, indoorDepth);
  }

  addFacade(floor, x, backWallZ, width, docks);
  for (const point of docks) {
    addDock(floor, point);
  }
  if (dock !== undefined && yard !== undefined) {
    addParking(floor, dock, docks, yard, { depth, width, x, z });
  }

  if (receiving !== undefined) {
    addReceivingMarks(floor, receiving);
  }

  floor.set('sideRim', [...aisleMarks]);
  return floor;
};
