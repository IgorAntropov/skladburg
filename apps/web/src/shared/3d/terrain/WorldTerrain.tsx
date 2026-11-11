import type { ReactElement } from 'react';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import { MeshStandardMaterial } from 'three';

import type { QualityLevelValue } from '../quality/qualityLevel';
import type { WorldTerrainValue } from './terrainTypes';

import { useWorldMaterial } from '../materials/useWorldMaterial';
import { useWorldPalette } from '../materials/useWorldPalette';
import { createGroundGeometry } from './createGroundGeometry';
import { createGroundGrain } from './createGroundGrain';
import { paintGroundGeometry } from './paintGroundGeometry';
import { skipRaycast } from './skipRaycast';
import { TerrainDecorLayer } from './TerrainDecorLayer';

interface WorldTerrainProps {
  level: QualityLevelValue;
  terrain: WorldTerrainValue;
}

export const WorldTerrain = ({ level, terrain }: WorldTerrainProps): ReactElement => {
  const palette = useWorldPalette();
  const water = useWorldMaterial('water');

  const groundGeometry = useMemo(() => createGroundGeometry(terrain), [terrain]);
  const grain = useMemo(() => createGroundGrain(groundGeometry.boundingBox), [groundGeometry]);
  const land = useMemo(
    () => new MeshStandardMaterial({ flatShading: true, map: grain, roughness: 1, vertexColors: true }),
    [grain],
  );
  const groundMaterials = useMemo(() => [land, water], [land, water]);

  useLayoutEffect(() => {
    const startedAt = performance.now();
    paintGroundGeometry(groundGeometry, terrain.groundWeights, palette);
    performance.measure('WorldTerrain.paint', { end: performance.now(), start: startedAt });
  }, [groundGeometry, palette, terrain.groundWeights]);

  useEffect(() => {
    return () => {
      groundGeometry.dispose();
      land.dispose();
      grain.dispose();
    };
  }, [grain, groundGeometry, land]);

  return (
    <>
      <mesh frustumCulled={false} geometry={groundGeometry} material={groundMaterials} raycast={skipRaycast} receiveShadow />
      {terrain.decor.map(decor => (
        <TerrainDecorLayer decor={decor} key={decor.kind} level={level} />
      ))}
    </>
  );
};
