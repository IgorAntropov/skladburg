import type { ReactElement } from 'react';
import type { BufferGeometry } from 'three';

import {
  useEffect,
  useMemo,
} from 'react';

import type { QualityLevelValue } from '@/shared/3d';

import {
  QUALITY_LEVEL_SETTINGS,
  useShadowMapRefresh,
} from '@/shared/3d';

import type { WorldModelMaterialsValue } from '../models/createWorldModelMaterials';
import type { WorldModelDataValue } from '../models/format/worldModelFormat';
import type { WorldModelPlacementValue } from '../models/placeWorldModels';
import type { IndustrialYardPlacementValue } from '../yard/placeIndustrialYard';

import { PLAZA_HEIGHT_METERS } from '../geometry/networkSceneMetrics';
import { getVisibleBuildingCount } from '../layout';
import { createWorldModelGeometry } from '../models/createWorldModelGeometry';
import { INDUSTRIAL_YARD_MODEL } from '../models/worldModelCatalog';
import { InstancedLayer } from './InstancedLayer';

interface NetworkModelBuildingsProps {
  level: QualityLevelValue;
  materials: WorldModelMaterialsValue;
  models: ReadonlyMap<string, WorldModelDataValue>;
  placements: readonly WorldModelPlacementValue[];
  yard: IndustrialYardPlacementValue | undefined;
}

const createGeometries = (
  modelIds: readonly string[],
  models: ReadonlyMap<string, WorldModelDataValue>,
): ReadonlyMap<string, BufferGeometry> => new Map(
  modelIds.flatMap((modelId): [string, BufferGeometry][] => {
    const data = models.get(modelId);

    return data === undefined ? [] : [[modelId, createWorldModelGeometry(data)]];
  }),
);

export const NetworkModelBuildings = ({ level, materials, models, placements, yard }: NetworkModelBuildingsProps): ReactElement => {
  const { decorDensity, hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const refreshShadowMap = useShadowMapRefresh();

  const hasYard = yard !== undefined;
  const geometries = useMemo(() => {
    const modelIds = placements.map(({ modelId }) => modelId);

    if (hasYard) {
      modelIds.push(INDUSTRIAL_YARD_MODEL.id);
    }

    return createGeometries(modelIds, models);
  }, [hasYard, models, placements]);
  const yardGeometry = geometries.get(INDUSTRIAL_YARD_MODEL.id);
  const hasYardGeometry = yard !== undefined && yardGeometry !== undefined;

  useEffect(() => {
    refreshShadowMap();
  }, [decorDensity, hasShadows, placements, refreshShadowMap]);

  useEffect(() => {
    return () => {
      geometries.forEach((geometry) => {
        geometry.dispose();
      });
    };
  }, [geometries]);

  return (
    <>
      {hasYardGeometry && (
        <mesh
          geometry={yardGeometry}
          material={materials.warehouse}
          position={[yard.x, PLAZA_HEIGHT_METERS, yard.z]}
          receiveShadow={hasShadows}
          rotation={[0, yard.rotation, 0]}
        />
      )}
      {placements.map((placement) => {
        const geometry = geometries.get(placement.modelId);

        return geometry === undefined
          ? null
          : (
              <InstancedLayer
                count={getVisibleBuildingCount(placement.items, decorDensity)}
                delays={undefined}
                geometry={geometry}
                hasShadowCast={hasShadows}
                hasShadowReceive={hasShadows}
                key={placement.modelId}
                material={materials[placement.group]}
                matrices={placement.matrices}
                tints={placement.tints}
              />
            );
      })}
    </>
  );
};
