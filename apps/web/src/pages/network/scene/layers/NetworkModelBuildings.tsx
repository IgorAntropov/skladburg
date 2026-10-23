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

import type { WorldModelDataValue } from '../models/format/worldModelFormat';
import type { WorldModelPlacementValue } from '../models/placeWorldModels';

import { getVisibleBuildingCount } from '../layout';
import { createWorldModelGeometry } from '../models/createWorldModelGeometry';
import { useWorldModelMaterials } from '../models/useWorldModelMaterials';
import { InstancedLayer } from './InstancedLayer';

interface NetworkModelBuildingsProps {
  level: QualityLevelValue;
  models: ReadonlyMap<string, WorldModelDataValue>;
  placements: readonly WorldModelPlacementValue[];
}

const createGeometries = (
  placements: readonly WorldModelPlacementValue[],
  models: ReadonlyMap<string, WorldModelDataValue>,
): ReadonlyMap<string, BufferGeometry> => new Map(
  placements.flatMap(({ modelId }): [string, BufferGeometry][] => {
    const data = models.get(modelId);

    return data === undefined ? [] : [[modelId, createWorldModelGeometry(data)]];
  }),
);

export const NetworkModelBuildings = ({ level, models, placements }: NetworkModelBuildingsProps): ReactElement => {
  const { decorDensity, hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const refreshShadowMap = useShadowMapRefresh();
  const materials = useWorldModelMaterials();

  const geometries = useMemo(() => createGeometries(placements, models), [models, placements]);

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
