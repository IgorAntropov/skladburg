import type {
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
import {
  buildWarehouseRackDeck,
  buildWarehouseRackFrame,
  getWarehouseRackFrameWidth,
  readWarehouseFloor,
  WAREHOUSE_MM_PER_METER,
  WAREHOUSE_RACK_HEADROOM,
  WAREHOUSE_RACK_MIN_HEIGHT,
} from './warehouseRackGeometry';
import {
  buildWarehouseYardRoads,
  WAREHOUSE_TRUCK_CENTER_Z,
  WAREHOUSE_TRUCK_SWEEP_RADIUS,
} from './warehouseYardRoads';

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

interface WarehouseLayoutCacheValue {
  key: string;
  layout: WarehouseLayoutValue;
}

const layouts = new WeakMap<WarehouseTopology, WarehouseLayoutCacheValue>();
let recentLayout: undefined | WarehouseLayoutCacheValue;
const DOCK_MIN_SPACING_MM = 2660;
export const WAREHOUSE_DOCK_RAMP_END = 0.505;
export const WAREHOUSE_DOCK_HANDOFF_Z = 0.4;

const readDock = (point: undefined | WarehouseUnloadingPoint): undefined | WarehouseDockLayoutValue => {
  const position = point?.position;
  if (point === undefined || position === undefined
    || !Number.isInteger(position.xMm) || position.xMm < 0 || !Number.isInteger(position.zMm) || position.zMm < 0) {
    return undefined;
  }

  return { id: point.id, x: position.xMm / WAREHOUSE_MM_PER_METER, z: position.zMm / WAREHOUSE_MM_PER_METER };
};

const readDocks = (
  primary: WarehouseDockLayoutValue,
  points: readonly WarehouseUnloadingPoint[],
): readonly WarehouseDockLayoutValue[] => {
  const docks = [primary];

  for (const candidate of points) {
    const point = readDock(candidate);
    if (point?.z !== primary.z || point.id === '') {
      continue;
    }
    const hasConflict = docks.some(dock => dock.id === point.id
      || Math.abs(Math.round((point.x - dock.x) * WAREHOUSE_MM_PER_METER)) < DOCK_MIN_SPACING_MM);
    if (!hasConflict) {
      docks.push(point);
    }
  }

  return docks;
};

const buildWarehouseLayout = (topology: WarehouseTopology): WarehouseLayoutValue => {
  const cells: WarehouseCellVisualValue[] = [];
  const aisleMarks: WarehouseBoxValue[] = [];
  const decks: WarehouseBoxValue[] = [];
  const dividers: WarehouseBoxValue[] = [];
  const frames: WarehouseBoxValue[] = [];
  const guards: WarehouseBoxValue[] = [];
  const obstacles: WarehouseAisleRectValue[] = [];
  const area = topology.receivingArea;
  const floor = readWarehouseFloor(area?.footprint);
  const point = floor === undefined ? undefined : readDock(area?.unloadingPoint);
  const dock = point === undefined ? undefined : { x: point.x, z: point.z };
  const docks = point === undefined ? [] : readDocks(point, area?.additionalUnloadingPoints ?? []);
  const receiving = floor === undefined || area === undefined
    ? undefined
    : {
        ...floor,
        dock,
        docks,
        id: area.id,
      };
  const warehouse = readWarehouseFloor(topology.bounds);
  const extent = warehouse ?? receiving;
  let minX = warehouse?.x ?? 0;
  let minZ = warehouse?.z ?? 0;
  let maxX = extent === undefined ? 6 : extent.x + extent.width;
  let maxZ = extent === undefined ? 4 : extent.z + extent.depth;
  let maxHeight = 2.43;

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
        const rect = readWarehouseFloor(rack.footprint);
        if (rect === undefined) {
          continue;
        }

        const { depth, width, x, z } = rect;
        const centerX = x + width / 2;
        const centerZ = z + depth / 2;
        const frameWidth = getWarehouseRackFrameWidth(width);
        const guardDepth = Math.min(0.095, depth / 4);
        const footprint = {
          maxX: x + width + frameWidth * 0.675,
          maxZ: z + depth + 0.026 + guardDepth / 2,
          minX: x - frameWidth * 0.675,
          minZ: z,
        };
        let height = WAREHOUSE_RACK_MIN_HEIGHT;

        for (const tier of rack.tiers) {
          const elevation = tier.elevationMm / WAREHOUSE_MM_PER_METER;
          height = Math.max(height, elevation + WAREHOUSE_RACK_HEADROOM);
          decks.push(buildWarehouseRackDeck(centerX, centerZ, width, depth, elevation));
          for (const cell of tier.cells) {
            const cellWidth = cell.widthMm / WAREHOUSE_MM_PER_METER;
            const start = x + cell.xOffsetMm / WAREHOUSE_MM_PER_METER;
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
          frames.push(buildWarehouseRackFrame(sideX, centerZ, frameWidth, depth, height));
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
  const building = { depth: maxZ - minZ, width: maxX - minX, x: minX, z: minZ };
  const yard = buildWarehouseYardRoads(docks);
  const grounds = { ...building };
  if (yard !== undefined && dock !== undefined) {
    grounds.x = Math.min(minX, dock.x + yard.apron.minX);
    grounds.z = Math.min(minZ, dock.z + yard.entrance.z + WAREHOUSE_TRUCK_CENTER_Z - WAREHOUSE_TRUCK_SWEEP_RADIUS);
    grounds.width = Math.max(maxX, dock.x + yard.apron.maxX) - grounds.x;
    grounds.depth = maxZ - grounds.z;
  }
  const home = docks.length > 2 ? grounds : building;
  const radius = Math.max(4.5, Math.hypot(home.width, home.depth) * 0.52);
  const padding = 18 + Math.max(4.5, Math.hypot(grounds.width, grounds.depth) * 0.52) * 5;
  for (const { x, z } of docks) {
    obstacles.push({ maxX: x + 0.93, maxZ: z + WAREHOUSE_DOCK_RAMP_END, minX: x - 0.93, minZ: z - 0.145 });
  }
  const bounds = { maxX, maxZ, minX: minX + 0.19, minZ: (dock?.z ?? minZ) + 0.11 };
  return {
    cells,
    cellsById: new Map(cells.map(cell => [cell.id, cell])),
    floor: buildWarehouseFloor(grounds, receiving, yard, aisleMarks, padding, warehouse ?? building),
    navigation: { bounds, obstacles },
    racks: { decks, dividers, frames, guards },
    receiving,
    world: {
      bounds: {
        maxX: grounds.x + grounds.width + padding,
        maxZ: grounds.z + grounds.depth + padding,
        minX: grounds.x - padding,
        minZ: grounds.z - padding,
      },
      home: { centerX: home.x + home.width / 2, centerZ: home.z + home.depth / 2, radius },
      maxHeight,
    },
    yard,
  };
};

export const getWarehouseLayout = (topology: WarehouseTopology): WarehouseLayoutValue => {
  const current = layouts.get(topology);
  if (current !== undefined) {
    recentLayout = current;
    return current.layout;
  }

  const key = JSON.stringify(topology, (field, value: unknown) => field === 'revision' || field === 'capabilities' ? undefined : value);
  const next = recentLayout?.key === key ? recentLayout : { key, layout: buildWarehouseLayout(topology) };
  layouts.set(topology, next);
  recentLayout = next;
  return next.layout;
};
