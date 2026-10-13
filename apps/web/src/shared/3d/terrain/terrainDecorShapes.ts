export interface TerrainConiferShapeValue extends TerrainTreeShapeValue {
  crownBaseHeight: number;
  crownHeight: number;
}

export interface TerrainDeciduousShapeValue extends TerrainTreeShapeValue {
  crownCenterHeight: number;
}

export interface TerrainDecorShapesValue {
  conifer: TerrainConiferShapeValue;
  deciduous: TerrainDeciduousShapeValue;
  rock: TerrainRockShapeValue;
}

export interface TerrainRockShapeValue {
  radius: number;
}

export interface TerrainScaleRangeValue {
  max: number;
  min: number;
}

export interface TerrainTreeShapeValue {
  crownRadius: number;
  trunkHeight: number;
  trunkRadius: number;
}

export const TERRAIN_DECOR_SHAPES: TerrainDecorShapesValue = {
  conifer: { crownBaseHeight: 0.7, crownHeight: 3.4, crownRadius: 1.05, trunkHeight: 0.9, trunkRadius: 0.16 },
  deciduous: { crownCenterHeight: 1.9, crownRadius: 1.15, trunkHeight: 1.2, trunkRadius: 0.17 },
  rock: { radius: 0.5 },
};

export const TERRAIN_DECIDUOUS_SCALE: TerrainScaleRangeValue = { max: 1.4, min: 0.8 };

export const TERRAIN_CONIFER_SCALE: TerrainScaleRangeValue = { max: 1.45, min: 0.85 };

export const TERRAIN_ROCK_SCALE: TerrainScaleRangeValue = { max: 1.5, min: 0.5 };

export const TERRAIN_ROCK_FLATTENING: TerrainScaleRangeValue = { max: 0.85, min: 0.55 };

export const TERRAIN_TREE_PROPORTION_SPREAD = 0.16;
