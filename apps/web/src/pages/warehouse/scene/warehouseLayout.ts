import type {
  WarehouseFloorRect,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

import type {
  SceneWorldValue,
  WorldPaletteKeyValue,
} from '@/shared/3d';

export interface WarehouseBoxValue {
  position: VectorValue;
  size: VectorValue;
}

export interface WarehouseCellVisualValue extends WarehouseBoxValue {
  id: string;
}

type VectorValue = [number, number, number];

interface WarehouseFloorValue {
  depth: number;
  width: number;
  x: number;
  z: number;
}

interface WarehouseLayoutValue {
  boxes: ReadonlyMap<WorldPaletteKeyValue, readonly WarehouseBoxValue[]>;
  cells: readonly WarehouseCellVisualValue[];
  cellsById: ReadonlyMap<string, WarehouseCellVisualValue>;
  receiving: undefined | WarehouseReceivingLayoutValue;
  truck: ReadonlyMap<WorldPaletteKeyValue, readonly WarehouseBoxValue[]>;
  world: SceneWorldValue;
}

interface WarehouseReceivingLayoutValue extends WarehouseFloorValue {
  dock: undefined | { x: number; z: number };
  id: string;
}

const layouts = new WeakMap<WarehouseTopology, WarehouseLayoutValue>();
const METER = 1000;
const TRUCK_LENGTH = 6.2;

const readFloor = (rect: undefined | WarehouseFloorRect): undefined | WarehouseFloorValue => {
  if (rect?.origin === undefined || rect.widthMm === 0 || rect.depthMm === 0) {
    return undefined;
  }

  return { depth: rect.depthMm / METER, width: rect.widthMm / METER, x: rect.origin.xMm / METER, z: rect.origin.zMm / METER };
};

const addBox = (
  layers: Map<WorldPaletteKeyValue, WarehouseBoxValue[]>,
  material: WorldPaletteKeyValue,
  position: VectorValue,
  size: VectorValue,
): void => {
  const box = { position, size };
  const layer = layers.get(material);
  if (layer === undefined) {
    layers.set(material, [box]);
  }
  else {
    layer.push(box);
  }
};

const buildTruck = ({ x, z }: NonNullable<WarehouseReceivingLayoutValue['dock']>): Map<WorldPaletteKeyValue, WarehouseBoxValue[]> => {
  const boxes = new Map<WorldPaletteKeyValue, WarehouseBoxValue[]>();
  addBox(boxes, 'road', [x, 0.36, z - 3.1], [1.36, 0.29, 5.8]);
  addBox(boxes, 'warehouseWall', [x, 0.64, z - 2.16], [1.68, 0.2, 4.04]);
  addBox(boxes, 'warehouseRoof', [x, 1, z - 4.13], [1.68, 0.7, 0.12]);
  addBox(boxes, 'sideCarrier', [x, 0.91, z - 5.1], [1.59, 1.15, 1.58]);
  addBox(boxes, 'windowGlass', [x, 1.35, z - 5.89], [1.2, 0.35, 0.03]);
  addBox(boxes, 'sideRim', [x, 0.52, z - 5.92], [1.66, 0.14, 0.12]);
  for (const offset of [-0.78, 0.78]) {
    addBox(boxes, 'warehouseRoof', [x + offset, 0.89, z - 2.17], [0.1, 0.36, 3.96]);
    addBox(boxes, 'windowGlass', [x + offset, 1.27, z - 5.19], [0.05, 0.35, 0.73]);
    addBox(boxes, 'windowGlow', [x + offset * 0.79, 0.67, z - 5.93], [0.22, 0.13, 0.04]);
    for (const axle of [0.96, 1.58, 4.83, 5.63]) {
      addBox(boxes, 'road', [x + offset, 0.26, z - axle], [0.25, 0.52, 0.52]);
      addBox(boxes, 'sideRim', [x + offset * 1.17, 0.26, z - axle], [0.04, 0.2, 0.2]);
    }
  }
  return boxes;
};

const buildWarehouseLayout = (topology: WarehouseTopology): WarehouseLayoutValue => {
  const boxes = new Map<WorldPaletteKeyValue, WarehouseBoxValue[]>();
  const cells: WarehouseCellVisualValue[] = [];
  const floor = readFloor(topology.receivingArea?.footprint);
  const point = topology.receivingArea?.unloadingPoint?.position;
  const receiving = floor === undefined || topology.receivingArea === undefined
    ? undefined
    : {
        ...floor,
        dock: point === undefined ? undefined : { x: point.xMm / METER, z: point.zMm / METER },
        id: topology.receivingArea.id,
      };
  const dock = receiving?.dock;
  let minX = Math.min(0, (dock?.x ?? 2) - 1.5);
  let minZ = Math.min(0, (dock?.z ?? TRUCK_LENGTH) - TRUCK_LENGTH);
  let maxX = receiving === undefined ? 6 : receiving.x + receiving.width;
  let maxZ = receiving === undefined ? 4 : receiving.z + receiving.depth;
  let maxHeight = 2.4;

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
        let height = 0.8;

        for (const tier of rack.tiers) {
          const elevation = tier.elevationMm / METER;
          height = Math.max(height, elevation + 0.75);
          addBox(boxes, 'warehouseWall', [centerX, elevation + 0.05, centerZ], [width, 0.1, depth]);
          addBox(boxes, 'buildingBrick', [centerX, elevation + 0.1, z + depth], [width, 0.11, 0.055]);
          for (const cell of tier.cells) {
            const cellWidth = cell.widthMm / METER;
            const start = x + cell.xOffsetMm / METER;
            cells.push({
              id: cell.id,
              position: [start + cellWidth / 2, elevation + 0.147, centerZ],
              size: [cellWidth, 0.025, depth],
            });
            addBox(boxes, 'warehouseRoof', [start + 0.015, elevation + 0.16, centerZ], [0.03, 0.09, depth]);
          }
        }

        for (const sideX of [x, x + width]) {
          for (const sideZ of [z, z + depth]) {
            addBox(boxes, 'warehouseRoof', [sideX, height / 2, sideZ], [0.055, height, 0.055]);
          }
        }

        addBox(boxes, 'sideRim', [centerX, 0.007, centerZ + depth / 2 + 0.18], [width + 0.2, 0.015, 0.035]);
        minX = Math.min(minX, x);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x + width);
        maxZ = Math.max(maxZ, z + depth);
        maxHeight = Math.max(maxHeight, height);
      }
    }
  }

  if (receiving !== undefined) {
    const { depth, width, x, z } = receiving;
    addBox(boxes, 'plaza', [x + width / 2, 0.019, z + depth / 2], [width, 0.038, depth]);
    for (const edge of [x, x + width]) {
      addBox(boxes, 'sand', [edge, 0.04, z + depth / 2], [0.055, 0.018, depth]);
    }
    addBox(boxes, 'sand', [x + width / 2, 0.04, z + depth], [width, 0.018, 0.055]);
  }

  if (dock !== undefined) {
    const { x, z } = dock;
    addBox(boxes, 'road', [x, 0.01, z - 3.22], [2.5, 0.02, 6.44]);
    addBox(boxes, 'warehouseRoof', [x, 0.16, z + 0.18], [1.86, 0.32, 0.65]);
    addBox(boxes, 'warehouseWall', [x, 2.32, z], [2.16, 0.2, 0.24]);
    for (const offset of [-1.02, 1.02]) {
      addBox(boxes, 'warehouseWall', [x + offset, 1.1, z], [0.2, 2.2, 0.24]);
      addBox(boxes, 'lampGlow', [x + offset, 2.17, z - 0.13], [0.12, 0.11, 0.03]);
      for (let index = 0; index < 6; index += 1) {
        addBox(boxes, 'sand', [x + offset * 1.15, 0.025, z - 0.6 - index], [0.045, 0.02, 0.55]);
      }
    }
  }

  minX -= 0.8;
  minZ -= 0.55;
  maxX += 1;
  maxZ += 0.8;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const radius = Math.max(4.5, Math.hypot(width, depth) * 0.52);
  const padding = 18 + radius * 5;
  const backWallZ = dock === undefined ? minZ : dock.z;
  const wallStartX = dock === undefined ? minX : dock.x + 1.12;
  if (wallStartX < maxX) {
    addBox(boxes, 'warehouseWall', [(wallStartX + maxX) / 2, 0.44, backWallZ], [maxX - wallStartX, 0.88, 0.16]);
  }
  addBox(boxes, 'warehouseWall', [minX, 0.44, (backWallZ + maxZ) / 2], [0.16, 0.88, maxZ - backWallZ]);
  addBox(boxes, 'groundAlt', [centerX, -0.14, centerZ], [width, 0.28, depth]);
  addBox(boxes, 'ground', [centerX, -0.33, centerZ], [width + 2 * padding, 0.1, depth + 2 * padding]);

  return {
    boxes,
    cells,
    cellsById: new Map(cells.map(cell => [cell.id, cell])),
    receiving,
    truck: dock === undefined ? new Map() : buildTruck(dock),
    world: {
      bounds: { maxX: maxX + padding, maxZ: maxZ + padding, minX: minX - padding, minZ: minZ - padding },
      home: { centerX, centerZ, radius },
      maxHeight,
    },
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
