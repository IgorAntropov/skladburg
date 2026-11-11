import type { SceneWorldValue } from '../world/sceneWorld';

export interface TerrainCorridorValue {
  points: readonly TerrainPointValue[];
  width: number;
}

export type TerrainDecorKindValue = 'conifer' | 'deciduous' | 'rock';

export interface TerrainDecorValue {
  kind: TerrainDecorKindValue;
  matrices: Float32Array;
  ranks: Float32Array;
  tints: Float32Array;
}

export interface TerrainGroundMeshValue {
  groundGroups: readonly TerrainSurfaceGroupValue[];
  groundIndex: Uint16Array | Uint32Array;
  groundPositions: Float32Array;
  groundWeights: Uint8Array;
}

export interface TerrainPointValue {
  x: number;
  z: number;
}

export interface TerrainReservedAreaValue {
  radius: number;
  x: number;
  z: number;
}

export interface TerrainReservedValue {
  areas: readonly TerrainReservedAreaValue[];
  corridors: readonly TerrainCorridorValue[];
}

export interface TerrainSurfaceGroupValue {
  count: number;
  key: TerrainSurfaceKeyValue;
  start: number;
}

export type TerrainSurfaceKeyValue = 'field' | 'fieldAlt' | 'ground' | 'groundAlt' | 'sand' | 'water';

export interface WorldTerrainParamsValue {
  reserved: TerrainReservedValue;
  seed: number;
  world: SceneWorldValue;
}

export interface WorldTerrainValue extends TerrainGroundMeshValue {
  decor: readonly TerrainDecorValue[];
  forestShare: number;
  triangleCount: number;
}
