import type { WorldGeometryKeyValue } from '../geometry/createWorldGeometryRegistry';
import type { WorldPaletteKeyValue } from '../palette/worldPaletteKeys';
import type { TerrainDecorKindValue } from './terrainTypes';

export interface TerrainDecorPartValue {
  geometry: WorldGeometryKeyValue;
  material: WorldPaletteKeyValue;
}

export const TERRAIN_DECOR_PARTS: Readonly<Record<TerrainDecorKindValue, readonly TerrainDecorPartValue[]>> = {
  conifer: [
    { geometry: 'coniferTrunk', material: 'treeTrunk' },
    { geometry: 'coniferCrown', material: 'treeCrownDark' },
  ],
  deciduous: [
    { geometry: 'deciduousTrunk', material: 'treeTrunk' },
    { geometry: 'deciduousCrown', material: 'treeCrown' },
  ],
  rock: [{ geometry: 'rock', material: 'rock' }],
};
