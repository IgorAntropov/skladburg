import type {
  ReactElement,
  RefObject,
} from 'react';
import type {
  Group,
  Mesh,
  Object3D,
} from 'three';

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import {
  BufferGeometry,
  Float32BufferAttribute,
} from 'three';

import { useWorldMaterial } from '@/shared/3d';

import type { WarehouseForkliftPoseValue } from './warehouseForkliftRoute';

import forklift from './warehouseForklift.json';
import { FORKLIFT_SCALE } from './warehouseForkliftRoute';

export interface WarehouseForkliftRigValue {
  body: Object3D;
  carriage: Object3D;
  mast: Object3D;
  tines: Object3D;
}

interface ForkliftPartValue {
  indices: number[];
  positions: number[];
}

interface WarehouseForkliftProps {
  rig: RefObject<null | WarehouseForkliftRigValue>;
}

const TINE_LENGTH = 1.5 - forklift.tineBaseZ;
const MAST_HEIGHT = 2.6 - forklift.mastBaseY;

const buildGeometry = ({ indices, positions }: ForkliftPartValue): BufferGeometry => {
  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  return geometry;
};

export const createWarehouseForkliftGeometries = (): Record<'body' | 'carriage' | 'chassis' | 'mast' | 'tines', BufferGeometry> => ({
  body: buildGeometry(forklift.body),
  carriage: buildGeometry(forklift.carriage),
  chassis: buildGeometry(forklift.chassis),
  mast: buildGeometry(forklift.mast),
  tines: buildGeometry(forklift.tines),
});

export const applyWarehouseForkliftPose = (
  rig: null | WarehouseForkliftRigValue,
  pose: undefined | WarehouseForkliftPoseValue,
): void => {
  if (rig === null) {
    return;
  }

  rig.body.visible = pose !== undefined;
  if (pose === undefined) {
    return;
  }

  const lift = pose.lift / FORKLIFT_SCALE;
  const reach = pose.reach / FORKLIFT_SCALE;
  rig.body.position.set(pose.x, 0, pose.z);
  rig.body.rotation.y = pose.yaw;
  rig.carriage.position.y = lift;
  rig.mast.scale.y = 1 + lift / MAST_HEIGHT;
  rig.mast.position.y = -forklift.mastBaseY * (rig.mast.scale.y - 1);
  rig.tines.scale.z = 1 + reach / TINE_LENGTH;
  rig.tines.position.z = -forklift.tineBaseZ * (rig.tines.scale.z - 1);
};

export const WarehouseForklift = ({ rig }: WarehouseForkliftProps): ReactElement => {
  const accent = useWorldMaterial('buildingRoofAlt');
  const dark = useWorldMaterial('road');
  const steel = useWorldMaterial('warehouseRoof');
  const body = useRef<Group>(null);
  const carriage = useRef<Group>(null);
  const mast = useRef<Mesh>(null);
  const tines = useRef<Mesh>(null);
  const geometries = useMemo(() => createWarehouseForkliftGeometries(), []);

  useImperativeHandle<null | WarehouseForkliftRigValue, null | WarehouseForkliftRigValue>(rig, () => {
    if (body.current !== null && carriage.current !== null && mast.current !== null && tines.current !== null) {
      return { body: body.current, carriage: carriage.current, mast: mast.current, tines: tines.current };
    }

    return null;
  }, []);

  useEffect(() => (): void => {
    for (const geometry of Object.values(geometries)) {
      geometry.dispose();
    }
  }, [geometries]);

  return (
    <group name="warehouse-forklift" ref={body} scale={FORKLIFT_SCALE} visible={false}>
      <mesh geometry={geometries.body} material={accent} receiveShadow />
      <mesh geometry={geometries.chassis} material={dark} receiveShadow />
      <mesh geometry={geometries.mast} material={steel} receiveShadow ref={mast} />
      <group ref={carriage}>
        <mesh geometry={geometries.carriage} material={steel} receiveShadow />
        <mesh geometry={geometries.tines} material={steel} receiveShadow ref={tines} />
      </group>
    </group>
  );
};
