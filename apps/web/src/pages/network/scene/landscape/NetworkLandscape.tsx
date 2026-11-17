import type { ReactElement } from 'react';
import type {
  BufferGeometry,
  Material,
} from 'three';

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

import type { WorldModelDataValue } from '../models/format/worldModelFormat';

import { InstancedLayer } from '../layers/InstancedLayer';
import { createWorldModelGeometry } from '../models/createWorldModelGeometry';
import { createLandscapeGeometries } from './createLandscapeGeometries';
import { NetworkWater } from './NetworkWater';

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
  tree: undefined | WorldModelDataValue;
  treeMaterial: Material;
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

const FOREST_TREE_WIDTH_SCALE = 5.2;

const FOREST_TREE_HEIGHT_SCALE = 8.8;

const LOW_FOREST_DENSITY = 0.22;

export const NetworkLandscape = ({ level, terrain, tree, treeMaterial }: NetworkLandscapeProps): ReactElement => {
  const refreshShadowMap = useShadowMapRefresh();
  const { decorDensity, hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const forestDensity = level === 'low' ? LOW_FOREST_DENSITY : decorDensity;
  const hasDetailedCrown = level === 'high';
  const geometries = useMemo(() => createLandscapeGeometries(), []);
  const treeGeometry = useMemo((): BufferGeometry | undefined => {
    if (tree === undefined) {
      return undefined;
    }

    const geometry = createWorldModelGeometry({ ...tree, positions: tree.positions.slice() });

    return geometry.scale(FOREST_TREE_WIDTH_SCALE, FOREST_TREE_HEIGHT_SCALE, FOREST_TREE_WIDTH_SCALE);
  }, [tree]);
  const water = terrain.groundGroups.find(({ key }) => key === 'water');
  const defaultTerrain = useMemo((): WorldTerrainValue => ({
    ...terrain,
    decor: terrain.decor.filter(({ kind }) => kind === 'deciduous' && treeGeometry === undefined),
    groundGroups: terrain.groundGroups.filter(({ key }) => key !== 'water'),
    groundIndex: terrain.groundIndex.subarray(0, water?.start ?? terrain.groundIndex.length),
  }), [terrain, treeGeometry, water]);
  const { decor } = terrain;
  const trees = decor.find(({ kind }) => kind === 'deciduous');
  const spruces = decor.find(({ kind }) => kind === 'conifer');
  const rocks = decor.find(({ kind }) => kind === 'rock');
  const crown = hasDetailedCrown ? geometries.detailedSpruceCrown : geometries.spruceCrown;
  const treeCount = trees === undefined ? 0 : getDecorCountForDensity(trees.ranks, forestDensity);
  const spruceCount = spruces === undefined ? 0 : getDecorCountForDensity(spruces.ranks, forestDensity);
  const rockCount = rocks === undefined ? 0 : getDecorCountForDensity(rocks.ranks, decorDensity);

  useEffect((): void => {
    refreshShadowMap();
  }, [crown, decor, decorDensity, forestDensity, refreshShadowMap, treeGeometry]);

  useEffect(() => {
    return (): void => {
      geometries.detailedSpruceCrown.dispose();
      geometries.rock.dispose();
      geometries.spruceCrown.dispose();
      geometries.spruceTrunk.dispose();
    };
  }, [geometries]);

  useEffect(() => {
    return () => {
      treeGeometry?.dispose();
    };
  }, [treeGeometry]);

  return (
    <>
      <WorldTerrain level={level} terrain={defaultTerrain} />
      {water !== undefined && <NetworkWater count={water.count} firstIndex={water.start} terrain={terrain} />}
      {trees !== undefined && treeGeometry !== undefined && (
        <InstancedLayer
          count={treeCount}
          delays={undefined}
          geometry={treeGeometry}
          hasShadowCast={hasShadows}
          hasShadowReceive={false}
          material={treeMaterial}
          matrices={trees.matrices}
          tints={trees.tints}
        />
      )}
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
