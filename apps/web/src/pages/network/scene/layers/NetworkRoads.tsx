import type { ReactElement } from 'react';
import type { Material } from 'three';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import { Color } from 'three';

import {
  useWorldMaterial,
  useWorldPalette,
} from '@/shared/3d';

import type { NetworkSceneRoadValue } from '../layout';
import type { CityStreetsValue } from '../layout/buildCityStreets';
import type { WorldModelDataValue } from '../models/format/worldModelFormat';

import { toCssColor } from '../banner/siteBannerColors';
import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from '../geometry/composeInstanceMatrix';
import { createRoadGeometry } from '../geometry/createRoadGeometry';
import {
  PLAZA_HEIGHT_METERS,
  ROAD_HEIGHT_METERS,
} from '../geometry/networkSceneMetrics';
import { ROAD_WIDTH_METERS } from '../layout';
import {
  CITY_DRIVEWAY_WIDTH_METERS,
  CITY_STREET_WIDTH_METERS,
} from '../layout/buildCityStreets';
import { createWorldModelGeometry } from '../models/createWorldModelGeometry';
import { InstancedLayer } from './InstancedLayer';

interface NetworkRoadsProps {
  cityStreets: CityStreetsValue | undefined;
  hasShadowReceive: boolean;
  model: undefined | WorldModelDataValue;
  modelMaterial: Material;
  roads: readonly NetworkSceneRoadValue[];
}

const ROAD_ASPHALT_SHARE = 0.65;
const ROAD_TILE_LENGTH_METERS = 4.5;
const SIDEWALK_HEIGHT_SCALE = 0.85;
const CITY_STREET_HEIGHT = ROAD_HEIGHT_METERS + 0.002;
const DRIVEWAY_HEIGHT = ROAD_HEIGHT_METERS + 0.004;
const DRIVEWAY_LOT_HEIGHT = PLAZA_HEIGHT_METERS + 0.004;
const CITY_STREET_PAVEMENT_SHARE = 0.14;

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

export const NetworkRoads = ({ cityStreets, hasShadowReceive, model, modelMaterial, roads }: NetworkRoadsProps): ReactElement => {
  const fallbackMaterial = useWorldMaterial('road');
  const drivewayMaterial = useWorldMaterial('plaza');
  const palette = useWorldPalette();
  const highways = cityStreets?.highways ?? roads;
  const geometry = useMemo(() => model === undefined ? createRoadGeometry(highways) : createWorldModelGeometry(model), [highways, model]);
  const matrices = useMemo(() => model === undefined ? undefined : buildRoadModelMatrices(highways), [highways, model]);
  const streets = useMemo(() => cityStreets === undefined
    ? undefined
    : createRoadGeometry(cityStreets.streets, CITY_STREET_WIDTH_METERS, CITY_STREET_HEIGHT, CITY_STREET_WIDTH_METERS / 2), [cityStreets]);
  const streetMaterial = useMemo(() => fallbackMaterial.clone(), [fallbackMaterial]);
  const driveways = useMemo(() => {
    if (cityStreets === undefined) {
      return undefined;
    }

    const sections = cityStreets.driveways.flatMap(({ curb, from, to }) => [
      { from, to: curb },
      { endHeight: DRIVEWAY_HEIGHT, from: curb, to },
    ]);

    return createRoadGeometry(sections, CITY_DRIVEWAY_WIDTH_METERS, DRIVEWAY_LOT_HEIGHT);
  }, [cityStreets]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => () => {
    streets?.dispose();
  }, [streets]);
  useEffect(() => () => {
    driveways?.dispose();
  }, [driveways]);
  useEffect(() => () => {
    streetMaterial.dispose();
  }, [streetMaterial]);
  useLayoutEffect(() => {
    streetMaterial.color.setStyle(toCssColor(palette.road)).lerp(new Color(toCssColor(palette.plaza)), CITY_STREET_PAVEMENT_SHARE);
  }, [palette.plaza, palette.road, streetMaterial]);

  return (
    <>
      {highways.length > 0 && (matrices === undefined
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
          ))}
      {streets !== undefined && <mesh geometry={streets} material={streetMaterial} receiveShadow={hasShadowReceive} />}
      {driveways !== undefined && <mesh geometry={driveways} material={drivewayMaterial} receiveShadow={hasShadowReceive} />}
    </>
  );
};
