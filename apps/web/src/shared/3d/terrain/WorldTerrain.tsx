import type { ReactElement } from 'react';

import {
  useEffect,
  useMemo,
} from 'react';

import type { QualityLevelValue } from '../quality/qualityLevel';
import type { WorldTerrainValue } from './terrainTypes';

import { useWorldMaterialsContext } from '../materials/useWorldMaterialsContext';
import { QUALITY_LEVEL_SETTINGS } from '../quality/qualityLevel';
import { createGroundGeometry } from './createGroundGeometry';
import { skipRaycast } from './skipRaycast';
import { TerrainDecorLayer } from './TerrainDecorLayer';

interface WorldTerrainProps {
  level: QualityLevelValue;
  terrain: WorldTerrainValue;
}

export const WorldTerrain = ({ level, terrain }: WorldTerrainProps): ReactElement => {
  const { registry } = useWorldMaterialsContext();

  const groundGeometry = useMemo(() => createGroundGeometry(terrain), [terrain]);
  const groundMaterials = useMemo(
    () => terrain.groundGroups.map(group => registry.get(group.key)),
    [registry, terrain.groundGroups],
  );

  const { decorDensity } = QUALITY_LEVEL_SETTINGS[level];

  useEffect(() => {
    return () => {
      groundGeometry.dispose();
    };
  }, [groundGeometry]);

  return (
    <>
      <mesh frustumCulled={false} geometry={groundGeometry} material={groundMaterials} raycast={skipRaycast} />
      {terrain.decor.map(decor => (
        <TerrainDecorLayer decor={decor} density={decorDensity} key={decor.kind} />
      ))}
    </>
  );
};
