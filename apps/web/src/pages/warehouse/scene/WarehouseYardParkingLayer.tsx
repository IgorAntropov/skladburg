import type {
  ReactElement,
  RefObject,
} from 'react';
import type { InstancedMesh } from 'three';

import {
  useImperativeHandle,
  useRef,
} from 'react';
import {
  DynamicDrawUsage,
  Matrix4,
  Sphere,
  Vector3,
} from 'three';

import type { WarehouseTruckModelValue } from './useWarehouseTruckModel';
import type { WarehouseDockPointValue } from './warehouseLayout';
import type { WarehouseParkingPoseValue } from './warehouseYardMotion';
import type { WarehouseYardRoadsValue } from './warehouseYardRoads';

import {
  WAREHOUSE_TRUCK_CENTER_Z,
  WAREHOUSE_TRUCK_SWEEP_RADIUS,
} from './warehouseYardRoads';

export interface WarehouseYardParkingRigValue {
  paint: (parking: readonly WarehouseParkingPoseValue[]) => void;
}

interface WarehouseYardParkingProps {
  dock: WarehouseDockPointValue;
  model: WarehouseTruckModelValue;
  parked: readonly WarehouseParkingPoseValue[];
  rig: RefObject<null | WarehouseYardParkingRigValue>;
  roads: WarehouseYardRoadsValue;
}

export const WarehouseYardParking = ({ dock, model, parked, rig, roads }: WarehouseYardParkingProps): ReactElement => {
  const ref = useRef<InstancedMesh>(null);
  const capacity = roads.parking.length;

  useImperativeHandle(rig, (): WarehouseYardParkingRigValue => {
    const matrix = new Matrix4();
    const mesh = ref.current;
    if (mesh !== null) {
      const { maxX, maxZ, minX } = roads.apron;
      const minZ = roads.entrance.z - WAREHOUSE_TRUCK_SWEEP_RADIUS;
      mesh.boundingSphere = new Sphere(
        new Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2),
        Math.hypot((maxX - minX) / 2, (maxZ - minZ) / 2, WAREHOUSE_TRUCK_SWEEP_RADIUS),
      );
    }

    const paint = (parking: readonly WarehouseParkingPoseValue[]): void => {
      if (mesh === null) {
        return;
      }

      const count = Math.min(parking.length, capacity);
      let written = 0;
      for (let index = 0; index < count; index += 1) {
        const pose = parking[index];

        if (pose !== undefined) {
          mesh.setMatrixAt(written, matrix.makeRotationY(pose.yaw).setPosition(pose.offsetX, 0, pose.offsetZ));
          written += 1;
        }
      }
      mesh.count = written;
      mesh.instanceMatrix.needsUpdate = true;
    };
    paint(parked);
    return { paint };
  }, [capacity, parked, roads]);

  return (
    <group name="warehouse-yard-parking" position={[dock.x, 0, dock.z + WAREHOUSE_TRUCK_CENTER_Z]}>
      <instancedMesh
        args={[model.geometry, model.material, capacity]}
        count={0}
        instanceMatrix-usage={DynamicDrawUsage}
        receiveShadow
        ref={ref}
      />
    </group>
  );
};
