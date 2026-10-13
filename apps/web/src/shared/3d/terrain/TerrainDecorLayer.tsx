import type { ReactElement } from 'react';

import { useThree } from '@react-three/fiber';
import {
  useEffect,
  useMemo,
} from 'react';

import type { TerrainDecorValue } from './terrainTypes';

import { DecorInstancedMesh } from './DecorInstancedMesh';
import { TERRAIN_DECOR_PARTS } from './terrainDecorParts';
import { getDecorCountForDensity } from './terrainInstances';

interface TerrainDecorLayerProps {
  decor: TerrainDecorValue;
  density: number;
}

export const TerrainDecorLayer = ({ decor, density }: TerrainDecorLayerProps): ReactElement => {
  const invalidate = useThree(state => state.invalidate);
  const count = useMemo(() => getDecorCountForDensity(decor.ranks, density), [decor.ranks, density]);

  useEffect(() => {
    invalidate();
  }, [count, invalidate]);

  return (
    <>
      {TERRAIN_DECOR_PARTS[decor.kind].map(part => (
        <DecorInstancedMesh count={count} decor={decor} key={part.geometry} part={part} />
      ))}
    </>
  );
};
