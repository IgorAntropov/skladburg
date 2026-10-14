import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
} from 'react';

import type { TerrainDecorValue } from './terrainTypes';

import { useShadowMapRefresh } from '../lighting/shadowMapRefresh';
import { DecorInstancedMesh } from './DecorInstancedMesh';
import { TERRAIN_DECOR_PARTS } from './terrainDecorParts';
import { getDecorCountForDensity } from './terrainInstances';

interface TerrainDecorLayerProps {
  decor: TerrainDecorValue;
  density: number;
}

export const TerrainDecorLayer = ({ decor, density }: TerrainDecorLayerProps): ReactElement => {
  const refreshShadowMap = useShadowMapRefresh();
  const count = useMemo(() => getDecorCountForDensity(decor.ranks, density), [decor.ranks, density]);

  useEffect(() => {
    refreshShadowMap();
  }, [count, decor, refreshShadowMap]);

  return (
    <>
      {TERRAIN_DECOR_PARTS[decor.kind].map(part => (
        <DecorInstancedMesh count={count} decor={decor} key={part.geometry} part={part} />
      ))}
    </>
  );
};
