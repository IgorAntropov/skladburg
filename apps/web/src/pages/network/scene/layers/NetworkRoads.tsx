import type { ReactElement } from 'react';
import type { Material } from 'three';

import {
  useEffect,
  useMemo,
} from 'react';

import { useWorldMaterial } from '@/shared/3d';

import type { NetworkSceneRoadValue } from '../layout';
import type { WorldModelDataValue } from '../models/format/worldModelFormat';

import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from '../geometry/composeInstanceMatrix';
import { createRoadGeometry } from '../geometry/createRoadGeometry';
import { ROAD_HEIGHT_METERS } from '../geometry/networkSceneMetrics';
import { ROAD_WIDTH_METERS } from '../layout';
import { createWorldModelGeometry } from '../models/createWorldModelGeometry';
import { InstancedLayer } from './InstancedLayer';

interface NetworkRoadsProps {
  hasShadowReceive: boolean;
  model: undefined | WorldModelDataValue;
  modelMaterial: Material;
  roads: readonly NetworkSceneRoadValue[];
}

const ROAD_ASPHALT_SHARE = 0.65;
const ROAD_TILE_LENGTH_METERS = 4.5;
const SIDEWALK_HEIGHT_SCALE = 0.85;

const buildRoadModelMatrices = (roads: readonly NetworkSceneRoadValue[]): Float32Array => {
  const modules = roads.flatMap(({ from, to }) => {
    const x = to.x - from.x;
    const z = to.z - from.z;
    const length = Math.hypot(x, z);
    const count = Math.ceil(length / ROAD_TILE_LENGTH_METERS);
    const rotationY = Math.atan2(x, z);
    const scale = [ROAD_WIDTH_METERS / ROAD_ASPHALT_SHARE, SIDEWALK_HEIGHT_SCALE, length / Math.max(1, count)] as const;

    return Array.from({ length: count }, (_, index) => {
      const fraction = (index + 0.5) / count;
      return { rotationY, scale, x: from.x + x * fraction, y: ROAD_HEIGHT_METERS, z: from.z + z * fraction };
    });
  });
  const matrices = new Float32Array(modules.length * INSTANCE_MATRIX_ITEM_SIZE);

  modules.forEach((module, index) => {
    writeInstanceMatrix(matrices, index, module);
  });

  return matrices;
};

export const NetworkRoads = ({ hasShadowReceive, model, modelMaterial, roads }: NetworkRoadsProps): null | ReactElement => {
  const fallbackMaterial = useWorldMaterial('road');
  const geometry = useMemo(() => model === undefined ? createRoadGeometry(roads) : createWorldModelGeometry(model), [model, roads]);
  const matrices = useMemo(() => model === undefined ? undefined : buildRoadModelMatrices(roads), [model, roads]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (roads.length === 0) {
    return null;
  }

  return matrices === undefined
    ? <mesh frustumCulled={false} geometry={geometry} material={fallbackMaterial} receiveShadow={hasShadowReceive} />
    : (
        <InstancedLayer
          count={matrices.length / INSTANCE_MATRIX_ITEM_SIZE}
          delays={undefined}
          geometry={geometry}
          hasShadowCast={false}
          hasShadowReceive={hasShadowReceive}
          material={modelMaterial}
          matrices={matrices}
          tints={undefined}
        />
      );
};
