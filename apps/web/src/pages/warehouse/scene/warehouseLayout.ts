import type {
  WarehouseFloorRect,
  WarehouseTopology,
  WarehouseUnloadingPoint,
} from '@skladburg/contracts/wms/v1/topology';

import type {
  SceneWorldValue,
  WorldPaletteKeyValue,
} from '@/shared/3d';

import type { WarehouseAisleRectValue } from './warehouseAislePath';
import type { WarehouseYardRoadsValue } from './warehouseYardRoads';

import {
  buildWarehouseFloor,
  WAREHOUSE_DOCK_LANE_LENGTH,
} from './warehouseFloorLayout';
import { buildWarehouseYardRoads } from './warehouseYardRoads';

export interface WarehouseBoxValue {
  position: VectorValue;
  size: VectorValue;
}

export interface WarehouseCellVisualValue extends WarehouseBoxValue {
  id: string;
  rack: WarehouseAisleRectValue;
}

export interface WarehouseDockLayoutValue extends WarehouseDockPointValue {
  id: string;
}

export interface WarehouseDockPointValue {
  x: number;
  z: number;
}

export interface WarehouseFloorValue {
  depth: number;
  width: number;
  x: number;
  z: number;
}

export interface WarehouseLayoutValue {
  cells: readonly WarehouseCellVisualValue[];
  cellsById: ReadonlyMap<string, WarehouseCellVisualValue>;
  floor: ReadonlyMap<WorldPaletteKeyValue, readonly WarehouseBoxValue[]>;
  navigation: WarehouseNavigationValue;
  racks: WarehouseRackLayoutValue;
  receiving: undefined | WarehouseReceivingLayoutValue;
  world: SceneWorldValue;
  yard: undefined | WarehouseYardRoadsValue;
}

export interface WarehouseNavigationValue {
  bounds: WarehouseAisleRectValue;
  obstacles: readonly WarehouseAisleRectValue[];
}

export interface WarehouseRackLayoutValue {
  decks: readonly WarehouseBoxValue[];
  dividers: readonly WarehouseBoxValue[];
  frames: readonly WarehouseBoxValue[];
  guards: readonly WarehouseBoxValue[];
}

export interface WarehouseReceivingLayoutValue extends WarehouseFloorValue {
  dock: undefined | WarehouseDockPointValue;
  docks: readonly WarehouseDockLayoutValue[];
  id: string;
}

type VectorValue = [number, number, number];

const layouts = new WeakMap<WarehouseTopology, WarehouseLayoutValue>();
const METER = 1000;
const DOCK_MIN_SPACING_MM = 2660;
export const WAREHOUSE_DOCK_RAMP_END = 0.505;
export const WAREHOUSE_DOCK_HANDOFF_Z = 0.4;

const readFloor = (rect: undefined | WarehouseFloorRect): undefined | WarehouseFloorValue => {
  if (rect?.origin === undefined || rect.widthMm === 0 || rect.depthMm === 0) {
    return undefined;
  }

  return { depth: rect.depthMm / METER, width: rect.widthMm / METER, x: rect.origin.xMm / METER, z: rect.origin.zMm / METER };
};

const readDock = (point: undefined | WarehouseUnloadingPoint): undefined | WarehouseDockLayoutValue => {
  const position = point?.position;
  if (point === undefined || position === undefined
    || !Number.isInteger(position.xMm) || position.xMm < 0 || !Number.isInteger(position.zMm) || position.zMm < 0) {
    return undefined;
  }

  return { id: point.id, x: position.xMm / METER, z: position.zMm / METER };
};

const readDocks = (
  primary: WarehouseDockLayoutValue,
  points: readonly WarehouseUnloadingPoint[],
  extraDocks: readonly WarehouseDockPointValue[],
): readonly WarehouseDockLayoutValue[] => {
  const docks = [primary];
  const candidates = [
    ...points.filter(point => point.id !== '').map(readDock),
    ...extraDocks.map(point => ({ ...point, id: '' })),
  ];

  for (const point of candidates) {
    if (point === undefined || !Number.isFinite(point.x) || point.z !== primary.z) {
      continue;
    }
    const hasConflict = docks.some(dock => (point.id !== '' && dock.id === point.id)
      || Math.abs(Math.round((point.x - dock.x) * METER)) < DOCK_MIN_SPACING_MM);
    if (!hasConflict) {
      docks.push(point);
    }
  }

  return docks;
};

export const buildWarehouseLayout = (
  topology: WarehouseTopology,
  additionalDocks: readonly WarehouseDockPointValue[] = [],
): WarehouseLayoutValue => {
  const cells: WarehouseCellVisualValue[] = [];
  const aisleMarks: WarehouseBoxValue[] = [];
  const decks: WarehouseBoxValue[] = [];
  const dividers: WarehouseBoxValue[] = [];
  const frames: WarehouseBoxValue[] = [];
  const guards: WarehouseBoxValue[] = [];
  const obstacles: WarehouseAisleRectValue[] = [];
  const area = topology.receivingArea;
  const floor = readFloor(area?.footprint);
  const point = floor === undefined ? undefined : readDock(area?.unloadingPoint);
  const dock = point === undefined ? undefined : { x: point.x, z: point.z };
  const docks = point === undefined ? [] : readDocks(point, area?.additionalUnloadingPoints ?? [], additionalDocks);
  const receiving = floor === undefined || area === undefined
    ? undefined
    : {
        ...floor,
        dock,
        docks,
        id: area.id,
      };
  let minX = 0;
  let minZ = 0;
  let maxX = receiving === undefined ? 6 : receiving.x + receiving.width;
  let maxZ = receiving === undefined ? 4 : receiving.z + receiving.depth;
  let maxHeight = 2.4;

  if (docks.length === 0) {
    maxX = Math.max(maxX, 1.5);
    maxZ = Math.max(maxZ, 0);
  }
  for (const { x, z } of docks) {
    minX = Math.min(minX, x - 1.5);
    minZ = Math.min(minZ, z - WAREHOUSE_DOCK_LANE_LENGTH);
    maxX = Math.max(maxX, x + 1.5);
    maxZ = Math.max(maxZ, z);
  }

  for (const zone of topology.storageZones) {
    for (const row of zone.rows) {
      for (const rack of row.racks) {
        const rect = readFloor(rack.footprint);
        if (rect === undefined) {
          continue;
        }

        const { depth, width, x, z } = rect;
        const centerX = x + width / 2;
        const centerZ = z + depth / 2;
        const frameWidth = Math.min(0.09, width * 0.14);
        const guardDepth = Math.min(0.095, depth / 4);
        const footprint = {
          maxX: x + width + frameWidth * 0.675,
          maxZ: z + depth + 0.026 + guardDepth / 2,
          minX: x - frameWidth * 0.675,
          minZ: z,
        };
        let height = 0.8;

        for (const tier of rack.tiers) {
          const elevation = tier.elevationMm / METER;
          height = Math.max(height, elevation + 0.75);
          decks.push({ position: [centerX, elevation + 0.088, centerZ], size: [width, 0.15, depth] });
          for (const cell of tier.cells) {
            const cellWidth = cell.widthMm / METER;
            const start = x + cell.xOffsetMm / METER;
            cells.push({
              id: cell.id,
              position: [start + cellWidth / 2, elevation + 0.147, centerZ],
              rack: footprint,
              size: [cellWidth, 0.025, depth],
            });
            const dividerWidth = Math.min(0.026, cellWidth / 5);
            dividers.push({
              position: [start + dividerWidth / 2, elevation + 0.16, centerZ],
              size: [dividerWidth, 0.045, depth * 0.96],
            });
          }
        }

        for (const sideX of [x, x + width]) {
          frames.push({ position: [sideX, height / 2, centerZ], size: [frameWidth, height, depth] });
          guards.push({
            position: [sideX, 0.15, z + depth + 0.026],
            size: [frameWidth * 1.35, 0.3, guardDepth],
          });
        }

        obstacles.push(footprint);
        aisleMarks.push({ position: [centerX, 0.012, z + depth + 0.18], size: [width, 0.012, 0.039] });
        minX = Math.min(minX, x);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x + width);
        maxZ = Math.max(maxZ, z + depth);
        maxHeight = Math.max(maxHeight, height);
      }
    }
  }

  minX -= 1.55;
  minZ -= 0.55;
  maxX += 1.55;
  maxZ += 1.65;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const radius = Math.max(4.5, Math.hypot(width, depth) * 0.52);
  const padding = 18 + radius * 5;
  for (const { x, z } of docks) {
    obstacles.push({ maxX: x + 0.93, maxZ: z + WAREHOUSE_DOCK_RAMP_END, minX: x - 0.93, minZ: z - 0.145 });
  }
  const bounds = { maxX, maxZ, minX: minX + 0.19, minZ: (dock?.z ?? minZ) + 0.11 };
  const yard = buildWarehouseYardRoads(docks);
  return {
    cells,
    cellsById: new Map(cells.map(cell => [cell.id, cell])),
    floor: buildWarehouseFloor({ depth, width, x: minX, z: minZ }, receiving, yard, aisleMarks, padding),
    navigation: { bounds, obstacles },
    racks: { decks, dividers, frames, guards },
    receiving,
    world: {
      bounds: { maxX: maxX + padding, maxZ: maxZ + padding, minX: minX - padding, minZ: minZ - padding },
      home: { centerX, centerZ, radius },
      maxHeight,
    },
    yard,
  };
};

export const getWarehouseLayout = (topology: WarehouseTopology): WarehouseLayoutValue => {
  const current = layouts.get(topology);
  if (current !== undefined) {
    return current;
  }

  const layout = buildWarehouseLayout(topology);
  layouts.set(topology, layout);
  return layout;
};
