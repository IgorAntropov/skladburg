import type { ReactElement } from 'react';
import type { Group } from 'three';

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
import { InstancedMesh } from 'three';

import type { MapSideValue } from '@/entities/network';

import { SIDE_SHAPES } from '@/entities/organization';
import { useWorldMaterial } from '@/shared/3d';

import type { ChipGeometriesValue } from '../geometry/createChipGeometry';
import type { NetworkSceneBuildingValue } from '../layout';

import { buildChipSets } from '../geometry/buildChipSets';
import {
  applyChipAzimuth,
  getCameraAzimuth,
} from '../geometry/chipOrientation';
import { INSTANCE_MATRIX_ITEM_SIZE } from '../geometry/composeInstanceMatrix';
import { createChipGeometries } from '../geometry/createChipGeometry';
import { createUnitBoxGeometry } from '../geometry/createUnitBoxGeometry';
import { CHIP_AZIMUTH_EPSILON_RADIANS } from '../geometry/networkSceneMetrics';
import { InstancedLayer } from './InstancedLayer';

interface NetworkSiteChipsProps {
  buildings: readonly NetworkSceneBuildingValue[];
}

const createAllChipGeometries = (): Record<MapSideValue, ChipGeometriesValue> => ({
  carrier: createChipGeometries(SIDE_SHAPES.carrier.outline),
  customer: createChipGeometries(SIDE_SHAPES.customer.outline),
  supplier: createChipGeometries(SIDE_SHAPES.supplier.outline),
});

export const NetworkSiteChips = ({ buildings }: NetworkSiteChipsProps): ReactElement => {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);

  const customerMaterial = useWorldMaterial('sideCustomer');
  const supplierMaterial = useWorldMaterial('sideSupplier');
  const carrierMaterial = useWorldMaterial('sideCarrier');
  const rimMaterial = useWorldMaterial('sideRim');

  const groupRef = useRef<Group>(null);
  const azimuthRef = useRef(0);

  const chipSets = useMemo(() => buildChipSets(buildings), [buildings]);
  const chipGeometries = useMemo(() => createAllChipGeometries(), []);
  const postGeometry = useMemo(() => createUnitBoxGeometry(), []);
  const sideMaterials = useMemo(
    () => ({ carrier: carrierMaterial, customer: customerMaterial, supplier: supplierMaterial }),
    [carrierMaterial, customerMaterial, supplierMaterial],
  );

  const turnChips = useCallback((azimuth: number): void => {
    for (const set of chipSets.sets) {
      applyChipAzimuth(set.matrices, set.count, azimuth);
    }

    const group = groupRef.current;

    if (group === null) {
      return;
    }

    for (const child of group.children) {
      if (child instanceof InstancedMesh) {
        child.instanceMatrix.needsUpdate = true;
      }
    }
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

    azimuthRef.current = azimuth;
    turnChips(azimuth);
    invalidate();
  }, [camera, invalidate, turnChips]);

  useEffect(() => {
    return () => {
      for (const geometries of Object.values(chipGeometries)) {
        geometries.body.dispose();
        geometries.rim.dispose();
      }

      postGeometry.dispose();
    };
  }, [chipGeometries, postGeometry]);

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
      </group>
      <InstancedLayer
        count={chipSets.postMatrices.length / INSTANCE_MATRIX_ITEM_SIZE}
        geometry={postGeometry}
        hasShadowCast={false}
        hasShadowReceive={false}
        material={rimMaterial}
        matrices={chipSets.postMatrices}
        tints={undefined}
      />
    </>
  );
};
