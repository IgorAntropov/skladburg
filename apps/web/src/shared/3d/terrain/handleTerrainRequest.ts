import type {
  TerrainWorkerRequestValue,
  TerrainWorkerResponseValue,
} from './terrainWorkerProtocol';

import { generateWorldTerrain } from './generateWorldTerrain';

export interface TerrainReplyValue {
  response: TerrainWorkerResponseValue;
  transfer: ArrayBuffer[];
}

const collectBuffers = (arrays: readonly Float32Array[]): ArrayBuffer[] => {
  const buffers = new Set<ArrayBuffer>();

  for (const array of arrays) {
    if (array.buffer instanceof ArrayBuffer) {
      buffers.add(array.buffer);
    }
  }

  return [...buffers];
};

export const handleTerrainRequest = (request: TerrainWorkerRequestValue): TerrainReplyValue => {
  const startedAt = performance.now();
  const terrain = generateWorldTerrain(request.params);
  const generationMs = performance.now() - startedAt;

  return {
    response: { generationMs, terrain },
    transfer: collectBuffers([
      terrain.groundPositions,
      ...terrain.decor.flatMap(decor => [decor.matrices, decor.ranks, decor.tints]),
    ]),
  };
};
