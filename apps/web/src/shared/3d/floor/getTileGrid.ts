import type { SceneBoundsValue } from '../world/sceneBounds';

export interface TileCenterValue {
  x: number;
  z: number;
}

export interface TileGridValue {
  columns: number;
  count: number;
  originX: number;
  originZ: number;
  pitchX: number;
  pitchZ: number;
  rows: number;
}

export const getTileGrid = (bounds: SceneBoundsValue): TileGridValue => {
  const sizeX = bounds.maxX - bounds.minX;
  const sizeZ = bounds.maxZ - bounds.minZ;
  const columns = Math.max(1, Math.round(sizeX));
  const rows = Math.max(1, Math.round(sizeZ));
  const pitchX = sizeX / columns;
  const pitchZ = sizeZ / rows;

  return {
    columns,
    count: columns * rows,
    originX: bounds.minX + pitchX / 2,
    originZ: bounds.minZ + pitchZ / 2,
    pitchX,
    pitchZ,
    rows,
  };
};

export const getTileCenter = (grid: TileGridValue, index: number): TileCenterValue => {
  return {
    x: grid.originX + (index % grid.columns) * grid.pitchX,
    z: grid.originZ + Math.floor(index / grid.columns) * grid.pitchZ,
  };
};
