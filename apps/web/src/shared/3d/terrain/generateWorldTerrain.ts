import type {
  WorldTerrainParamsValue,
  WorldTerrainValue,
} from './terrainTypes';

import { createTerrainContext } from './terrainContext';
import { placeDecor } from './terrainDecor';
import {
  paintGroundTones,
  placeFields,
} from './terrainFields';
import { buildTerrainHeights } from './terrainHeights';
import { buildGroundMesh } from './terrainMesh';
import { clearReservedSurfaces } from './terrainReserveMask';
import { warpShoreVertices } from './terrainShoreWarp';
import {
  classifyWater,
  paintShoreSand,
} from './terrainWater';

export const generateWorldTerrain = (params: WorldTerrainParamsValue): WorldTerrainValue => {
  const context = createTerrainContext(params);
  const triangleSurface = new Uint8Array(context.grid.triangleCount);

  classifyWater(context, triangleSurface);

  const cellState = placeFields(context, triangleSurface);
  const openSurface = triangleSurface.slice();
  const warp = warpShoreVertices(context, openSurface);

  clearReservedSurfaces(context, triangleSurface);

  const vertexWater = paintShoreSand(context, triangleSurface);

  paintGroundTones(context, triangleSurface);

  const heights = buildTerrainHeights(context, openSurface, vertexWater);
  const { decor, forestShare } = placeDecor(context, openSurface, cellState, heights, warp);
  const { groundGroups, groundPositions } = buildGroundMesh(context, triangleSurface, heights, warp);

  return {
    decor,
    forestShare,
    groundGroups,
    groundPositions,
    triangleCount: context.grid.triangleCount,
  };
};
