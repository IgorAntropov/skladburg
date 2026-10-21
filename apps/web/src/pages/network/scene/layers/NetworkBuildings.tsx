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
  useWorldMaterial,
} from '@/shared/3d';

import type { BuildingPartKeyValue } from '../geometry/buildBuildingParts';
import type { NetworkSceneBuildingValue } from '../layout';

import { buildBuildingParts } from '../geometry/buildBuildingParts';
import { createGablePrismGeometry } from '../geometry/createGablePrismGeometry';
import { createUnitBoxGeometry } from '../geometry/createUnitBoxGeometry';
import { getVisibleBuildingCount } from '../layout';
import { InstancedLayer } from './InstancedLayer';

interface NetworkBuildingsProps {
  buildings: readonly NetworkSceneBuildingValue[];
  level: QualityLevelValue;
}

export const NetworkBuildings = ({ buildings, level }: NetworkBuildingsProps): ReactElement => {
  const { decorDensity, hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const refreshShadowMap = useShadowMapRefresh();

  const buildingWall = useWorldMaterial('buildingWall');
  const warehouseWall = useWorldMaterial('warehouseWall');
  const buildingRoof = useWorldMaterial('buildingRoof');
  const buildingRoofAlt = useWorldMaterial('buildingRoofAlt');
  const warehouseRoof = useWorldMaterial('warehouseRoof');

  const boxGeometry = useMemo(() => createUnitBoxGeometry(), []);
  const gableGeometry = useMemo(() => createGablePrismGeometry(), []);
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
    (): Record<'box' | 'gable', BufferGeometry> => ({ box: boxGeometry, gable: gableGeometry }),
    [boxGeometry, gableGeometry],
  );

  useEffect(() => {
    refreshShadowMap();
  }, [decorDensity, hasShadows, parts, refreshShadowMap]);

  useEffect(() => {
    return () => {
      boxGeometry.dispose();
      gableGeometry.dispose();
    };
  }, [boxGeometry, gableGeometry]);

  return (
    <>
      {parts.map(part => (
        <InstancedLayer
          count={getVisibleBuildingCount(part.items, decorDensity)}
          geometry={geometries[part.shape]}
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
