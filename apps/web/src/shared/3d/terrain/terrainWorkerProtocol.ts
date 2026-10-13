import type {
  WorldTerrainParamsValue,
  WorldTerrainValue,
} from './terrainTypes';

export interface TerrainWorkerRequestValue {
  params: WorldTerrainParamsValue;
}

export interface TerrainWorkerResponseValue {
  generationMs: number;
  terrain: WorldTerrainValue;
}
