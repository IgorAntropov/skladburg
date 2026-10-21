import type { NetworkMapCityValue } from '@/entities/network';
import type { SceneWorldValue } from '@/shared/3d';

import type { LayoutPointValue } from './networkSceneTypes';

import {
  MAP_CELL_METERS,
  MAP_EDGE_STRIP_METERS,
  MINI_CITY_RADIUS_METERS,
} from './layoutConstants';

export type MapGridCityValue = Pick<NetworkMapCityValue, 'id' | 'position'>;

export interface MapGridProjectionValue {
  cellMeters: number;
  centers: ReadonlyMap<string, LayoutPointValue>;
}

const fitCellMeters = (spanCells: number, availableHalfMeters: number, cellMeters: number): number => {
  if (spanCells <= 0) {
    return cellMeters;
  }

  return Math.min(cellMeters, (2 * Math.max(0, availableHalfMeters)) / spanCells);
};

export const projectMapGrid = (
  cities: readonly MapGridCityValue[],
  world: Pick<SceneWorldValue, 'bounds'>,
): MapGridProjectionValue => {
  const { bounds } = world;
  const worldCenterX = (bounds.minX + bounds.maxX) / 2;
  const worldCenterZ = (bounds.minZ + bounds.maxZ) / 2;

  if (cities.length === 0) {
    return { cellMeters: MAP_CELL_METERS, centers: new Map() };
  }

  const columns = cities.map(city => city.position.column);
  const rows = cities.map(city => city.position.row);
  const minColumn = Math.min(...columns);
  const maxColumn = Math.max(...columns);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const reserveMeters = MAP_EDGE_STRIP_METERS + MINI_CITY_RADIUS_METERS;
  const availableHalfX = (bounds.maxX - bounds.minX) / 2 - reserveMeters;
  const availableHalfZ = (bounds.maxZ - bounds.minZ) / 2 - reserveMeters;
  const cellMeters = fitCellMeters(
    maxRow - minRow,
    availableHalfZ,
    fitCellMeters(maxColumn - minColumn, availableHalfX, MAP_CELL_METERS),
  );
  const middleColumn = (minColumn + maxColumn) / 2;
  const middleRow = (minRow + maxRow) / 2;

  return {
    cellMeters,
    centers: new Map(cities.map(city => [
      city.id,
      {
        x: worldCenterX + (city.position.column - middleColumn) * cellMeters,
        z: worldCenterZ + (city.position.row - middleRow) * cellMeters,
      },
    ])),
  };
};
