import type { ReactElement } from 'react';
import type {
  BufferGeometry,
  Group,
} from 'three';

import {
  useFrame,
  useThree,
} from '@react-three/fiber';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import type { MapSideValue } from '@/entities/network';

import { SIDE_SHAPES } from '@/entities/organization';
import { useWorldMaterial } from '@/shared/3d';

import type { ChipSlotValue } from '../geometry/buildChipSets';
import type { ChipGeometriesValue } from '../geometry/createChipGeometry';
import type { OwnMarkerGeometriesValue } from '../geometry/createOwnMarkerGeometry';
import type { NetworkSceneBuildingValue } from '../layout';

import {
  buildChipSets,
  findChipSlot,
  writeChipMarkerMatrices,
} from '../geometry/buildChipSets';
import {
  applyChipAzimuth,
  getCameraAzimuth,
} from '../geometry/chipOrientation';
import { INSTANCE_MATRIX_ITEM_SIZE } from '../geometry/composeInstanceMatrix';
import { createChipGeometries } from '../geometry/createChipGeometry';
import { createOwnMarkerGeometries } from '../geometry/createOwnMarkerGeometry';
import { CHIP_AZIMUTH_EPSILON_RADIANS } from '../geometry/networkSceneMetrics';
import { InstancedLayer } from './InstancedLayer';
import { markInstanceMatricesUpdated } from './markInstanceMatricesUpdated';

interface NetworkSiteChipsProps {
  boxGeometry: BufferGeometry;
  buildings: readonly NetworkSceneBuildingValue[];
  hoveredId: string | undefined;
}

const createAllChipGeometries = (): Record<MapSideValue, ChipGeometriesValue> => ({
  carrier: createChipGeometries(SIDE_SHAPES.carrier.outline),
  customer: createChipGeometries(SIDE_SHAPES.customer.outline),
  supplier: createChipGeometries(SIDE_SHAPES.supplier.outline),
});

export const NetworkSiteChips = ({ boxGeometry, buildings, hoveredId }: NetworkSiteChipsProps): ReactElement => {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);

  const customerMaterial = useWorldMaterial('sideCustomer');
  const supplierMaterial = useWorldMaterial('sideSupplier');
  const carrierMaterial = useWorldMaterial('sideCarrier');
  const rimMaterial = useWorldMaterial('sideRim');
  const markerOutlineMaterial = useWorldMaterial('road');

  const groupRef = useRef<Group>(null);
  const azimuthRef = useRef(0);
  const hoveredSlotRef = useRef<ChipSlotValue | undefined>(undefined);

  const chipSets = useMemo(() => buildChipSets(buildings), [buildings]);
  const chipGeometries = useMemo(() => createAllChipGeometries(), []);
  const markerGeometries = useMemo((): OwnMarkerGeometriesValue => createOwnMarkerGeometries(), []);
  const sideMaterials = useMemo(
    () => ({ carrier: carrierMaterial, customer: customerMaterial, supplier: supplierMaterial }),
    [carrierMaterial, customerMaterial, supplierMaterial],
  );

  const turnChips = useCallback((azimuth: number): void => {
    const hoveredSlot = hoveredSlotRef.current;

    for (let setIndex = 0; setIndex < chipSets.sets.length; setIndex += 1) {
      const set = chipSets.sets[setIndex];

      if (set !== undefined) {
        applyChipAzimuth(
          set.matrices,
          set.count,
          azimuth,
          hoveredSlot?.setIndex === setIndex ? hoveredSlot.index : undefined,
        );
      }
    }

    writeChipMarkerMatrices(chipSets.markers, chipSets.sets);
    markInstanceMatricesUpdated(groupRef.current);
  }, [chipSets]);

  useFrame((state) => {
    const azimuth = getCameraAzimuth(state.camera.quaternion);

    if (Math.abs(azimuth - azimuthRef.current) < CHIP_AZIMUTH_EPSILON_RADIANS) {
      return;
    }

    azimuthRef.current = azimuth;
    turnChips(azimuth);
  });

  useLayoutEffect(() => {
    const azimuth = getCameraAzimuth(camera.quaternion);

    hoveredSlotRef.current = findChipSlot(chipSets.sets, hoveredId);
    azimuthRef.current = azimuth;
    turnChips(azimuth);
    invalidate();
  }, [camera, chipSets, hoveredId, invalidate, turnChips]);

  useEffect(() => {
    return () => {
      for (const geometries of Object.values(chipGeometries)) {
        geometries.body.dispose();
        geometries.rim.dispose();
      }

      markerGeometries.house.dispose();
      markerGeometries.outline.dispose();
    };
  }, [chipGeometries, markerGeometries]);

  return (
    <>
      <group ref={groupRef}>
        {chipSets.sets.map(set => (
          <Fragment key={set.side}>
            <InstancedLayer
              count={set.count}
              geometry={chipGeometries[set.side].rim}
              hasShadowCast={false}
              hasShadowReceive={false}
              material={rimMaterial}
              matrices={set.matrices}
              tints={undefined}
            />
            <InstancedLayer
              count={set.count}
              geometry={chipGeometries[set.side].body}
              hasShadowCast={false}
              hasShadowReceive={false}
              material={sideMaterials[set.side]}
              matrices={set.matrices}
              tints={undefined}
            />
          </Fragment>
        ))}
        <InstancedLayer
          count={chipSets.markers.count}
          geometry={markerGeometries.outline}
          hasShadowCast={false}
          hasShadowReceive={false}
          material={markerOutlineMaterial}
          matrices={chipSets.markers.matrices}
          tints={undefined}
        />
        <InstancedLayer
          count={chipSets.markers.count}
          geometry={markerGeometries.house}
          hasShadowCast={false}
          hasShadowReceive={false}
          material={rimMaterial}
          matrices={chipSets.markers.matrices}
          tints={undefined}
        />
      </group>
      <InstancedLayer
        count={chipSets.postMatrices.length / INSTANCE_MATRIX_ITEM_SIZE}
        geometry={boxGeometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={rimMaterial}
        matrices={chipSets.postMatrices}
        tints={undefined}
      />
    </>
  );
};
