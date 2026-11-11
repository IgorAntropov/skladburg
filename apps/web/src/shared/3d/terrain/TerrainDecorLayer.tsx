import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
} from 'react';

import type { QualityLevelValue } from '../quality/qualityLevel';
import type { TerrainDecorValue } from './terrainTypes';

import { useShadowMapRefresh } from '../lighting/shadowMapRefresh';
import { QUALITY_LEVEL_SETTINGS } from '../quality/qualityLevel';
import { DecorInstancedMesh } from './DecorInstancedMesh';
import { TERRAIN_DECOR_PARTS } from './terrainDecorParts';
import { getDecorCountForDensity } from './terrainInstances';

interface TerrainDecorLayerProps {
  decor: TerrainDecorValue;
  level: QualityLevelValue;
}

export const TerrainDecorLayer = ({ decor, level }: TerrainDecorLayerProps): ReactElement => {
  const refreshShadowMap = useShadowMapRefresh();
  const density = QUALITY_LEVEL_SETTINGS[level].decorDensity;
  const hasDetailedConifers = level === 'high' && decor.kind === 'conifer';
  const count = useMemo(() => getDecorCountForDensity(decor.ranks, density), [decor.ranks, density]);

  useEffect(() => {
    refreshShadowMap();
  }, [count, decor, hasDetailedConifers, refreshShadowMap]);

  return (
    <>
      {TERRAIN_DECOR_PARTS[decor.kind].map((part) => {
        const current = hasDetailedConifers && part.geometry === 'coniferCrown'
          ? { ...part, geometry: 'detailedConiferCrown' } as const
          : part;

        return <DecorInstancedMesh count={count} decor={decor} key={current.geometry} part={current} />;
      })}
    </>
  );
};
