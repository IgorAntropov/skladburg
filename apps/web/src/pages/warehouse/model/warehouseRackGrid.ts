import type {
  WarehouseFloorPoint,
  WarehouseFloorRect,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

export type WarehouseRackFootprintValue = Pick<WarehouseFloorRect, 'depthMm' | 'widthMm'> & { origin: WarehouseRackPositionValue };

export interface WarehouseRackGridObstacleValue {
  footprint: WarehouseRackFootprintValue;
  id: string;
  kind: 'rack' | 'receiving';
}

export interface WarehouseRackGridValue {
  depthMm: number;
  obstacles: readonly WarehouseRackGridObstacleValue[];
  widthMm: number;
}

export type WarehouseRackPositionValue = Pick<WarehouseFloorPoint, 'xMm' | 'zMm'>;

export const WAREHOUSE_RACK_GRID_STEP_MM = 100;
export const WAREHOUSE_RACK_CELL_WIDTH_MM = 600;
export const WAREHOUSE_RACK_CELL_OFFSETS_MM = [0, WAREHOUSE_RACK_CELL_WIDTH_MM] as const;
export const WAREHOUSE_RACK_WIDTH_MM = WAREHOUSE_RACK_CELL_WIDTH_MM * WAREHOUSE_RACK_CELL_OFFSETS_MM.length;
export const WAREHOUSE_RACK_DEPTH_MM = 1_000;
export const MAX_WAREHOUSE_COORDINATE_MM = 4_294_967_295;

const MIN_GRID_WIDTH_MM = 6_000;
const MIN_GRID_DEPTH_MM = 4_000;
const GRID_MARGIN_MM = 2_000;

export const hasWarehouseRackOrigin = (
  footprint: undefined | WarehouseFloorRect,
): footprint is WarehouseFloorRect & WarehouseRackFootprintValue => footprint?.origin !== undefined;

export const warehouseRackRightEdgeMm = ({ origin, widthMm }: WarehouseRackFootprintValue): number => origin.xMm + widthMm;

const bottomEdgeMm = ({ depthMm, origin }: WarehouseRackFootprintValue): number => origin.zMm + depthMm;

export const getWarehouseRackObstacles = (topology: WarehouseTopology): WarehouseRackGridObstacleValue[] => {
  const obstacles: WarehouseRackGridObstacleValue[] = [];
  const receiving = topology.receivingArea;
  if (receiving !== undefined && hasWarehouseRackOrigin(receiving.footprint)) {
    obstacles.push({ footprint: receiving.footprint, id: receiving.id, kind: 'receiving' });
  }

  for (const zone of topology.storageZones) {
    for (const row of zone.rows) {
      for (const { footprint, id } of row.racks) {
        if (hasWarehouseRackOrigin(footprint)) {
          obstacles.push({ footprint, id, kind: 'rack' });
        }
      }
    }
  }

  return obstacles;
};

const gridDimensionMm = (lastEdgeMm: number, minSizeMm: number): number => Math.min(
  MAX_WAREHOUSE_COORDINATE_MM,
  Math.max(minSizeMm, Math.ceil((lastEdgeMm + GRID_MARGIN_MM) / WAREHOUSE_RACK_GRID_STEP_MM) * WAREHOUSE_RACK_GRID_STEP_MM),
);

export const createWarehouseRackGrid = (
  topology: null | WarehouseTopology,
  footprint: WarehouseRackFootprintValue,
  minimumSize?: Pick<WarehouseRackGridValue, 'depthMm' | 'widthMm'>,
): WarehouseRackGridValue => {
  const obstacles = topology === null ? [] : getWarehouseRackObstacles(topology);
  let maxX = warehouseRackRightEdgeMm(footprint);
  let maxZ = bottomEdgeMm(footprint);

  for (const obstacle of obstacles) {
    maxX = Math.max(maxX, warehouseRackRightEdgeMm(obstacle.footprint));
    maxZ = Math.max(maxZ, bottomEdgeMm(obstacle.footprint));
  }

  return {
    depthMm: gridDimensionMm(maxZ, minimumSize?.depthMm ?? MIN_GRID_DEPTH_MM),
    obstacles,
    widthMm: gridDimensionMm(maxX, minimumSize?.widthMm ?? MIN_GRID_WIDTH_MM),
  };
};

const snapCoordinateMm = (coordinateMm: number, maxMm: number): number => Math.max(0, Math.min(
  Math.round(coordinateMm / WAREHOUSE_RACK_GRID_STEP_MM),
  Math.floor(maxMm / WAREHOUSE_RACK_GRID_STEP_MM),
)) * WAREHOUSE_RACK_GRID_STEP_MM;

export const snapWarehouseRackPosition = (
  { depthMm, widthMm }: WarehouseRackGridValue,
  { xMm, zMm }: WarehouseRackPositionValue,
): WarehouseRackPositionValue => ({
  xMm: snapCoordinateMm(xMm, widthMm - WAREHOUSE_RACK_WIDTH_MM),
  zMm: snapCoordinateMm(zMm, depthMm - WAREHOUSE_RACK_DEPTH_MM),
});

export const findWarehouseRackObstacle = (
  { obstacles }: WarehouseRackGridValue,
  footprint: WarehouseRackFootprintValue,
): undefined | WarehouseRackGridObstacleValue => obstacles.find(({ footprint: obstacle }) => (
  obstacle.origin.xMm < warehouseRackRightEdgeMm(footprint) && footprint.origin.xMm < warehouseRackRightEdgeMm(obstacle)
  && obstacle.origin.zMm < bottomEdgeMm(footprint) && footprint.origin.zMm < bottomEdgeMm(obstacle)
));
