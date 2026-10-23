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

import type { NetworkSceneBuildingValue } from '../layout';
import type { WorldModelDataValue } from '../models/format/worldModelFormat';
import type { WorldModelEntryValue } from '../models/worldModelCatalog';

import { getVisibleBuildingCount } from '../layout';
import { createWorldModelGeometry } from '../models/createWorldModelGeometry';
import { placeWorldModels } from '../models/placeWorldModels';
import { useWorldModelMaterials } from '../models/useWorldModelMaterials';
import { InstancedLayer } from './InstancedLayer';

interface NetworkModelBuildingsProps {
  buildings: readonly NetworkSceneBuildingValue[];
  level: QualityLevelValue;
  models: ReadonlyMap<string, WorldModelDataValue>;
  pickModel: (building: NetworkSceneBuildingValue) => undefined | WorldModelEntryValue;
}

const createGeometries = (models: ReadonlyMap<string, WorldModelDataValue>): ReadonlyMap<string, BufferGeometry> => new Map(
  [...models.entries()].map(([id, data]): [string, BufferGeometry] => [id, createWorldModelGeometry(data)]),
);

export const NetworkModelBuildings = ({ buildings, level, models, pickModel }: NetworkModelBuildingsProps): ReactElement => {
  const { decorDensity, hasShadows } = QUALITY_LEVEL_SETTINGS[level];
  const refreshShadowMap = useShadowMapRefresh();
  const materials = useWorldModelMaterials();

  const geometries = useMemo(() => createGeometries(models), [models]);
  const placements = useMemo(() => placeWorldModels(buildings, pickModel, models), [buildings, models, pickModel]);

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
