import type { ReactElement } from 'react';
import type { Material } from 'three';

import {
  useEffect,
  useMemo,
} from 'react';

import { useWorldMaterial } from '@/shared/3d';

import type { NetworkSceneLayoutValue } from '../layout';
import type { WorldModelDataValue } from '../models/format/worldModelFormat';
import type { IndustrialYardPlacementValue } from '../yard/placeIndustrialYard';

import { buildPlazaMatrices } from '../geometry/buildPlazaMatrices';
import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from '../geometry/composeInstanceMatrix';
import { createPlazaGeometry } from '../geometry/createPlazaGeometry';
import { PLAZA_HEIGHT_METERS } from '../geometry/networkSceneMetrics';
import { MINI_CITY_SLOT_PITCH_METERS } from '../layout/layoutConstants';
import { getMiniCitySlots } from '../layout/miniCitySlots';
import { createWorldModelGeometry } from '../models/createWorldModelGeometry';
import { InstancedLayer } from './InstancedLayer';

interface NetworkCityPlazasProps {
  hasShadowReceive: boolean;
  layout: NetworkSceneLayoutValue;
  modelMaterial: Material;
  park: undefined | WorldModelDataValue;
  pavement: undefined | WorldModelDataValue;
  yard: IndustrialYardPlacementValue | undefined;
}

const PARK_HEIGHT_SCALE = 2;
const PAVEMENT_BASE_HEIGHT = 0.05;
const POSITION_TOLERANCE_METERS = 0.1;

const buildCityBlocks = (
  layout: NetworkSceneLayoutValue,
  yard: IndustrialYardPlacementValue | undefined,
  hasParks: boolean,
): { park: Float32Array; pavement: Float32Array } => {
  const pavements: number[] = [];
  const parks: number[] = [];
  const halfPitch = MINI_CITY_SLOT_PITCH_METERS / 2;

  for (const city of layout.cities) {
    const buildings = layout.buildings.filter(building => building.cityId === city.id);

    for (const slot of getMiniCitySlots(city.radius)) {
      const x = city.x + slot.x;
      const z = city.z + slot.z;
      const hasBuilding = buildings.some(building =>
        Math.abs(building.x - x) < POSITION_TOLERANCE_METERS && Math.abs(building.z - z) < POSITION_TOLERANCE_METERS);
      const isNearYard = yard !== undefined && Math.abs(yard.x - x) < halfPitch * 1.6 && Math.abs(yard.z - z) < halfPitch * 1.6;

      if (hasBuilding || isNearYard || !hasParks) {
        pavements.push(x, z);
      }
      else {
        parks.push(x, z);
      }
    }
  }

  const writeBlocks = (positions: number[], height: number): Float32Array => {
    const matrices = new Float32Array(positions.length / 2 * INSTANCE_MATRIX_ITEM_SIZE);

    for (let index = 0; index < positions.length; index += 2) {
      writeInstanceMatrix(matrices, index / 2, {
        rotationY: (index % 8) * Math.PI / 4,
        scale: [MINI_CITY_SLOT_PITCH_METERS, height, MINI_CITY_SLOT_PITCH_METERS],
        x: positions[index] ?? 0,
        y: 0,
        z: positions[index + 1] ?? 0,
      });
    }

    return matrices;
  };

  return {
    park: writeBlocks(parks, PARK_HEIGHT_SCALE),
    pavement: writeBlocks(pavements, PLAZA_HEIGHT_METERS / PAVEMENT_BASE_HEIGHT),
  };
};

export const NetworkCityPlazas = ({
  hasShadowReceive,
  layout,
  modelMaterial,
  park,
  pavement,
  yard,
}: NetworkCityPlazasProps): ReactElement => {
  const material = useWorldMaterial('plaza');
  const { cities } = layout;
  const geometry = useMemo(() => pavement === undefined ? createPlazaGeometry() : createWorldModelGeometry(pavement), [pavement]);
  const parkGeometry = useMemo(() => park === undefined ? undefined : createWorldModelGeometry(park), [park]);
  const blocks = useMemo(() => pavement === undefined ? undefined : buildCityBlocks(layout, yard, park !== undefined),
    [layout, park, pavement, yard]);
  const fallback = useMemo(() => blocks === undefined ? buildPlazaMatrices(cities) : undefined, [blocks, cities]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      parkGeometry?.dispose();
    };
  }, [parkGeometry]);

  const matrices = blocks?.pavement ?? fallback ?? new Float32Array();

  return (
    <>
      <InstancedLayer
        count={matrices.length / INSTANCE_MATRIX_ITEM_SIZE}
        delays={undefined}
        geometry={geometry}
        hasShadowCast={false}
        hasShadowReceive={hasShadowReceive}
        material={pavement === undefined ? material : modelMaterial}
        matrices={matrices}
        tints={undefined}
      />
      {blocks !== undefined && parkGeometry !== undefined && (
        <InstancedLayer
          count={blocks.park.length / INSTANCE_MATRIX_ITEM_SIZE}
          delays={undefined}
          geometry={parkGeometry}
          hasShadowCast={false}
          hasShadowReceive={hasShadowReceive}
          material={modelMaterial}
          matrices={blocks.park}
          tints={undefined}
        />
      )}
    </>
  );
};
