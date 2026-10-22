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
import { useWorldGlowMaterial } from '@/shared/3d';

import type { ChipGeometriesValue } from '../geometry/createChipGeometry';
import type { OwnMarkerGeometriesValue } from '../geometry/createOwnMarkerGeometry';
import type { NetworkSceneBuildingValue } from '../layout';

import {
  buildChipSets,
  createChipHoverMasks,
  fillChipHoverMasks,
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
import {
  UNLIT_RIM_SPEC,
  UNLIT_ROAD_SPEC,
  UNLIT_SIDE_SPECS,
} from './glowSpecs';
import { InstancedLayer } from './InstancedLayer';
import { markInstanceMatricesUpdated } from './markInstanceMatricesUpdated';

interface NetworkSiteChipsProps {
  boxGeometry: BufferGeometry;
  buildings: readonly NetworkSceneBuildingValue[];
  hoveredId: string | undefined;
  hoveredSiteIds: readonly string[];
}

const createAllChipGeometries = (): Record<MapSideValue, ChipGeometriesValue> => ({
  carrier: createChipGeometries(SIDE_SHAPES.carrier.outline),
  customer: createChipGeometries(SIDE_SHAPES.customer.outline),
  supplier: createChipGeometries(SIDE_SHAPES.supplier.outline),
});

export const NetworkSiteChips = ({
  boxGeometry,
  buildings,
  hoveredId,
  hoveredSiteIds,
}: NetworkSiteChipsProps): ReactElement => {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);

  const customerMaterial = useWorldGlowMaterial(UNLIT_SIDE_SPECS.customer);
  const supplierMaterial = useWorldGlowMaterial(UNLIT_SIDE_SPECS.supplier);
  const carrierMaterial = useWorldGlowMaterial(UNLIT_SIDE_SPECS.carrier);
  const rimMaterial = useWorldGlowMaterial(UNLIT_RIM_SPEC);
  const markerOutlineMaterial = useWorldGlowMaterial(UNLIT_ROAD_SPEC);

  const groupRef = useRef<Group>(null);
  const azimuthRef = useRef(0);

  const chipSets = useMemo(() => buildChipSets(buildings), [buildings]);
  const hoverMasks = useMemo(() => createChipHoverMasks(chipSets.sets), [chipSets]);
  const chipGeometries = useMemo(() => createAllChipGeometries(), []);
  const markerGeometries = useMemo((): OwnMarkerGeometriesValue => createOwnMarkerGeometries(), []);
  const sideMaterials = useMemo(
    () => ({ carrier: carrierMaterial, customer: customerMaterial, supplier: supplierMaterial }),
    [carrierMaterial, customerMaterial, supplierMaterial],
  );

  const turnChips = useCallback((azimuth: number): void => {
    for (let setIndex = 0; setIndex < chipSets.sets.length; setIndex += 1) {
      const set = chipSets.sets[setIndex];

      if (set !== undefined) {
        applyChipAzimuth(
          set.matrices,
          set.count,
          azimuth,
          hoverMasks[setIndex],
        );
      }
    }

    writeChipMarkerMatrices(chipSets.markers, chipSets.sets);
    markInstanceMatricesUpdated(groupRef.current);
  }, [chipSets, hoverMasks]);

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

    fillChipHoverMasks(hoverMasks, chipSets.sets, hoveredId, hoveredSiteIds);
    azimuthRef.current = azimuth;
    turnChips(azimuth);
    invalidate();
  }, [camera, chipSets, hoverMasks, hoveredId, hoveredSiteIds, invalidate, turnChips]);

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
              delays={undefined}
              geometry={chipGeometries[set.side].rim}
              hasShadowCast={false}
              hasShadowReceive={false}
              material={rimMaterial}
              matrices={set.matrices}
              tints={undefined}
            />
            <InstancedLayer
              count={set.count}
              delays={undefined}
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
          delays={undefined}
          geometry={markerGeometries.outline}
          hasShadowCast={false}
          hasShadowReceive={false}
          material={markerOutlineMaterial}
          matrices={chipSets.markers.matrices}
          tints={undefined}
        />
        <InstancedLayer
          count={chipSets.markers.count}
          delays={undefined}
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
        delays={undefined}
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
