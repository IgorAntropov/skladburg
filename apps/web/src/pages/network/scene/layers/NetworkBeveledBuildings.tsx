import type { ReactElement } from 'react';
import type {
  BufferGeometry,
  MeshStandardMaterial,
} from 'three';

import {
  useEffect,
  useMemo,
} from 'react';

import type { QualityLevelValue } from '@/shared/3d';

import {
  QUALITY_LEVEL_SETTINGS,
  useShadowMapRefresh,
} from '@/shared/3d';

import type { BuildingPartKeyValue } from '../geometry/buildBuildingParts';
import type { NetworkSceneBuildingValue } from '../layout';

import {
  BEVEL_SEGMENTS_BY_LEVEL,
  GABLE_BEVEL,
  GABLE_EAVE_SHADE,
  GABLE_SHADE_HEIGHT,
  NO_SHADE,
  SLAB_BEVEL_RADII,
  WALL_BEVEL_RADII,
  WALL_BOTTOM_SHADE,
  WALL_SHADE_HEIGHT,
} from '../geometry/bevelConstants';
import { buildBuildingParts } from '../geometry/buildBuildingParts';
import { createBeveledBoxGeometry } from '../geometry/createBeveledBoxGeometry';
import { createBeveledGableGeometry } from '../geometry/createBeveledGableGeometry';
import { getVisibleBuildingCount } from '../layout';
import { InstancedLayer } from './InstancedLayer';
import { useVertexColorMaterial } from './useVertexColorMaterial';

interface NetworkBeveledBuildingsProps {
  buildings: readonly NetworkSceneBuildingValue[];
  level: QualityLevelValue;
}

export const NetworkBeveledBuildings = ({ buildings, level }: NetworkBeveledBuildingsProps): ReactElement => {
  const { decorDensity, hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const refreshShadowMap = useShadowMapRefresh();
  const segments = BEVEL_SEGMENTS_BY_LEVEL[level];

  const buildingWall = useVertexColorMaterial('buildingWall');
  const warehouseWall = useVertexColorMaterial('warehouseWall');
  const buildingRoof = useVertexColorMaterial('buildingRoof');
  const buildingRoofAlt = useVertexColorMaterial('buildingRoofAlt');
  const warehouseRoof = useVertexColorMaterial('warehouseRoof');

  const wallGeometry = useMemo(
    (): BufferGeometry => createBeveledBoxGeometry({
      bottomShade: WALL_BOTTOM_SHADE,
      radii: WALL_BEVEL_RADII,
      segments,
      shadeHeight: WALL_SHADE_HEIGHT,
    }),
    [segments],
  );
  const slabGeometry = useMemo(
    (): BufferGeometry => createBeveledBoxGeometry({
      bottomShade: NO_SHADE,
      radii: SLAB_BEVEL_RADII,
      segments,
      shadeHeight: WALL_SHADE_HEIGHT,
    }),
    [segments],
  );
  const gableGeometry = useMemo(
    (): BufferGeometry => createBeveledGableGeometry({
      bevel: GABLE_BEVEL,
      eaveShade: GABLE_EAVE_SHADE,
      segments,
      shadeHeight: GABLE_SHADE_HEIGHT,
    }),
    [segments],
  );
  const parts = useMemo(() => buildBuildingParts(buildings), [buildings]);

  const materials = useMemo(
    (): Record<BuildingPartKeyValue, MeshStandardMaterial> => ({
      buildingRoof,
      buildingRoofAlt,
      buildingWall,
      warehouseRoof,
      warehouseWall,
    }),
    [buildingRoof, buildingRoofAlt, buildingWall, warehouseRoof, warehouseWall],
  );
  const geometries = useMemo(
    (): Record<BuildingPartKeyValue, BufferGeometry> => ({
      buildingRoof: gableGeometry,
      buildingRoofAlt: slabGeometry,
      buildingWall: wallGeometry,
      warehouseRoof: gableGeometry,
      warehouseWall: wallGeometry,
    }),
    [gableGeometry, slabGeometry, wallGeometry],
  );

  useEffect(() => {
    refreshShadowMap();
  }, [decorDensity, hasShadows, parts, refreshShadowMap, segments]);

  useEffect(() => {
    return () => {
      wallGeometry.dispose();
      slabGeometry.dispose();
      gableGeometry.dispose();
    };
  }, [gableGeometry, slabGeometry, wallGeometry]);

  return (
    <>
      {parts.map(part => (
        <InstancedLayer
          count={getVisibleBuildingCount(part.items, decorDensity)}
          delays={undefined}
          geometry={geometries[part.key]}
          hasShadowCast={hasShadows}
          hasShadowReceive={hasShadows}
          key={part.key}
          material={materials[part.key]}
          matrices={part.matrices}
          tints={part.tints}
        />
      ))}
    </>
  );
};
