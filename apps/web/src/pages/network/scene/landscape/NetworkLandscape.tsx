import type { ReactElement } from 'react';
import type { BufferGeometry } from 'three';

import {
  useEffect,
  useMemo,
} from 'react';

import type {
  QualityLevelValue,
  TerrainDecorValue,
  WorldPaletteKeyValue,
  WorldTerrainValue,
} from '@/shared/3d';

import {
  getDecorCountForDensity,
  QUALITY_LEVEL_SETTINGS,
  useShadowMapRefresh,
  useWorldMaterial,
  WorldTerrain,
} from '@/shared/3d';

import { InstancedLayer } from '../layers/InstancedLayer';
import { createLandscapeGeometries } from './createLandscapeGeometries';

interface LandscapeInstancesProps {
  count: number;
  decor: TerrainDecorValue;
  geometry: BufferGeometry;
  hasShadows: boolean;
  materialKey: WorldPaletteKeyValue;
}

interface NetworkLandscapeProps {
  level: QualityLevelValue;
  terrain: WorldTerrainValue;
}

const LandscapeInstances = ({
  count,
  decor,
  geometry,
  hasShadows,
  materialKey,
}: LandscapeInstancesProps): ReactElement => {
  const material = useWorldMaterial(materialKey);

  return (
    <InstancedLayer
      count={count}
      delays={undefined}
      geometry={geometry}
      hasShadowCast={hasShadows}
      hasShadowReceive={false}
      material={material}
      matrices={decor.matrices}
      tints={decor.tints}
    />
  );
};

export const NetworkLandscape = ({ level, terrain }: NetworkLandscapeProps): ReactElement => {
  const refreshShadowMap = useShadowMapRefresh();
  const { decorDensity, hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const hasDetailedCrown = level === 'high';
  const geometries = useMemo(() => createLandscapeGeometries(), []);
  const defaultTerrain = useMemo((): WorldTerrainValue => ({
    ...terrain,
    decor: terrain.decor.filter(({ kind }) => kind !== 'conifer' && kind !== 'rock'),
  }), [terrain]);
  const { decor } = terrain;
  const spruces = decor.find(({ kind }) => kind === 'conifer');
  const rocks = decor.find(({ kind }) => kind === 'rock');
  const crown = hasDetailedCrown ? geometries.detailedSpruceCrown : geometries.spruceCrown;
  const spruceCount = spruces === undefined ? 0 : getDecorCountForDensity(spruces.ranks, decorDensity);
  const rockCount = rocks === undefined ? 0 : getDecorCountForDensity(rocks.ranks, decorDensity);

  useEffect((): void => {
    refreshShadowMap();
  }, [crown, decor, decorDensity, refreshShadowMap]);

  useEffect(() => {
    return (): void => {
      geometries.detailedSpruceCrown.dispose();
      geometries.rock.dispose();
      geometries.spruceCrown.dispose();
      geometries.spruceTrunk.dispose();
    };
  }, [geometries]);

  return (
    <>
      <WorldTerrain level={level} terrain={defaultTerrain} />
      {spruces !== undefined && (
        <>
          <LandscapeInstances
            count={spruceCount}
            decor={spruces}
            geometry={geometries.spruceTrunk}
            hasShadows={hasShadows}
            materialKey="treeTrunk"
          />
          <LandscapeInstances
            count={spruceCount}
            decor={spruces}
            geometry={crown}
            hasShadows={hasShadows}
            materialKey="treeCrownDark"
          />
        </>
      )}
      {rocks !== undefined && (
        <LandscapeInstances
          count={rockCount}
          decor={rocks}
          geometry={geometries.rock}
          hasShadows={hasShadows}
          materialKey="rock"
        />
      )}
    </>
  );
};
