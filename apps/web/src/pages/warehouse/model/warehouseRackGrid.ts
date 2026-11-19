import type {
  WarehouseFloorPoint,
  WarehouseFloorRect,
  WarehouseTopology,
} from '@skladburg/contracts/wms/v1/topology';

import { readReceivingLayoutDocks } from './warehouseReceivingLayout';

export type WarehouseRackFootprintValue = Pick<WarehouseFloorRect, 'depthMm' | 'widthMm'> & { origin: WarehouseRackPositionValue };

export interface WarehouseRackGridObstacleValue {
  footprint: WarehouseRackFootprintValue;
  id: string;
  kind: 'dock-approach' | 'outside-zone' | 'rack' | 'receiving';
}

export interface WarehouseRackGridValue {
  activeZone?: undefined | WarehouseRackGridZoneValue;
  depthMm: number;
  docks?: readonly WarehouseRackGridDockValue[] | undefined;
  obstacles: readonly WarehouseRackGridObstacleValue[];
  widthMm: number;
  zones?: readonly WarehouseRackGridZoneValue[] | undefined;
}

export type WarehouseRackPositionValue = Pick<WarehouseFloorPoint, 'xMm' | 'zMm'>;

interface WarehouseRackGridDockValue {
  id: string;
  position: WarehouseRackPositionValue;
}

interface WarehouseRackGridZoneValue {
  footprint: WarehouseRackFootprintValue;
  id: string;
}

export const WAREHOUSE_RACK_GRID_STEP_MM = 100;
export const WAREHOUSE_RACK_CELL_WIDTH_MM = 600;
export const WAREHOUSE_RACK_CELL_OFFSETS_MM = [0, WAREHOUSE_RACK_CELL_WIDTH_MM] as const;
export const WAREHOUSE_RACK_WIDTH_MM = WAREHOUSE_RACK_CELL_WIDTH_MM * WAREHOUSE_RACK_CELL_OFFSETS_MM.length;
export const WAREHOUSE_RACK_DEPTH_MM = 1_000;
export const MAX_WAREHOUSE_COORDINATE_MM = 4_294_967_295;

const MIN_GRID_WIDTH_MM = 6_000;
const MIN_GRID_DEPTH_MM = 4_000;
const GRID_MARGIN_MM = 2_000;
const DOCK_MIN_SPACING_MM = 2_660;
const DOCK_APPROACH_HALF_WIDTH_MM = 1_250;
const DOCK_APPROACH_DEPTH_MM = 1_880;

export const hasWarehouseRackOrigin = (
  footprint: undefined | WarehouseFloorRect,
): footprint is WarehouseFloorRect & WarehouseRackFootprintValue => footprint?.origin !== undefined;

export const warehouseRackRightEdgeMm = ({ origin, widthMm }: WarehouseRackFootprintValue): number => origin.xMm + widthMm;

export const warehouseRackBottomEdgeMm = ({ depthMm, origin }: WarehouseRackFootprintValue): number => origin.zMm + depthMm;

const containsFootprint = (bounds: WarehouseRackFootprintValue, footprint: WarehouseRackFootprintValue): boolean =>
  footprint.origin.xMm >= bounds.origin.xMm && footprint.origin.zMm >= bounds.origin.zMm
  && warehouseRackRightEdgeMm(footprint) <= warehouseRackRightEdgeMm(bounds)
  && warehouseRackBottomEdgeMm(footprint) <= warehouseRackBottomEdgeMm(bounds);

const readDockPositions = (topology: null | WarehouseTopology): WarehouseRackGridDockValue[] => {
  const area = topology?.receivingArea;
  const footprint = area?.footprint;
  const primary = area?.unloadingPoint?.position;
  if (!hasWarehouseRackOrigin(footprint) || footprint.widthMm === 0 || footprint.depthMm === 0 || primary === undefined) {
    return [];
  }

  const results: WarehouseRackGridDockValue[] = [];
  for (const { id, position } of readReceivingLayoutDocks(area)) {
    if (position?.zMm === primary.zMm
      && !results.some(result => result.id === id || Math.abs(result.position.xMm - position.xMm) < DOCK_MIN_SPACING_MM)) {
      results.push({ id, position });
    }
  }
  return results;
};

export const getWarehouseRackObstacles = (topology: WarehouseTopology): WarehouseRackGridObstacleValue[] => {
  const obstacles: WarehouseRackGridObstacleValue[] = [];
  const receiving = topology.receivingArea;
  if (receiving !== undefined && hasWarehouseRackOrigin(receiving.footprint)) {
    obstacles.push({ footprint: receiving.footprint, id: receiving.id, kind: 'receiving' });
  }
  for (const { id, position: { xMm, zMm } } of readDockPositions(topology)) {
    obstacles.push({
      footprint: { depthMm: DOCK_APPROACH_DEPTH_MM, origin: { xMm: xMm - DOCK_APPROACH_HALF_WIDTH_MM, zMm },
        widthMm: DOCK_APPROACH_HALF_WIDTH_MM * 2 },
      id,
      kind: 'dock-approach',
    });
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
  draftFootprints: readonly WarehouseRackFootprintValue[] = [],
  activeZoneId?: string,
): WarehouseRackGridValue => {
  const obstacles = topology === null ? [] : getWarehouseRackObstacles(topology);
  const docks = readDockPositions(topology);
  const dockMarkers = docks.length === 0 ? {} : { docks };
  const bounds = topology?.bounds;
  if (hasWarehouseRackOrigin(bounds)) {
    const zones = topology?.storageZones.flatMap(zone => hasWarehouseRackOrigin(zone.bounds)
      ? [{ footprint: zone.bounds, id: zone.id }]
      : []) ?? [];

    return {
      ...dockMarkers,
      activeZone: zones.find(zone => zone.id === activeZoneId),
      depthMm: bounds.depthMm,
      obstacles,
      widthMm: bounds.widthMm,
      zones,
    };
  }

  let maxX = warehouseRackRightEdgeMm(footprint);
  let maxZ = warehouseRackBottomEdgeMm(footprint);

  for (const obstacle of obstacles) {
    maxX = Math.max(maxX, warehouseRackRightEdgeMm(obstacle.footprint));
    maxZ = Math.max(maxZ, warehouseRackBottomEdgeMm(obstacle.footprint));
  }
  for (const draft of draftFootprints) {
    maxX = Math.max(maxX, warehouseRackRightEdgeMm(draft));
    maxZ = Math.max(maxZ, warehouseRackBottomEdgeMm(draft));
  }
  for (const { position } of docks) {
    maxX = Math.max(maxX, position.xMm);
    maxZ = Math.max(maxZ, position.zMm);
  }

  return {
    ...dockMarkers,
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
  { activeZone, obstacles }: WarehouseRackGridValue,
  footprint: WarehouseRackFootprintValue,
): undefined | WarehouseRackGridObstacleValue => {
  if (activeZone !== undefined && !containsFootprint(activeZone.footprint, footprint)) {
    return { ...activeZone, kind: 'outside-zone' };
  }

  return obstacles.find(({ footprint: obstacle }) => (
    obstacle.origin.xMm < warehouseRackRightEdgeMm(footprint) && footprint.origin.xMm < warehouseRackRightEdgeMm(obstacle)
    && obstacle.origin.zMm < warehouseRackBottomEdgeMm(footprint) && footprint.origin.zMm < warehouseRackBottomEdgeMm(obstacle)
  ));
};
