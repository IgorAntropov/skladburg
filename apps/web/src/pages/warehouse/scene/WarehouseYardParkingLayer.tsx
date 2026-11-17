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
} from 'three';

import type { WarehouseTruckModelValue } from './useWarehouseTruckModel';
import type { WarehouseDockPointValue } from './warehouseLayout';

import { WAREHOUSE_YARD_PARKING_LIMIT } from './warehouseYardParking';
import { WAREHOUSE_TRUCK_CENTER_Z } from './warehouseYardRoads';

export interface WarehouseYardParkingRigValue {
  paint: (parking: readonly { offsetZ: number }[]) => void;
}

interface WarehouseYardParkingProps {
  dock: WarehouseDockPointValue;
  model: WarehouseTruckModelValue;
  rig: RefObject<null | WarehouseYardParkingRigValue>;
}

export const WarehouseYardParking = ({ dock, model, rig }: WarehouseYardParkingProps): ReactElement => {
  const ref = useRef<InstancedMesh>(null);

  useImperativeHandle(rig, (): WarehouseYardParkingRigValue => {
    const matrix = new Matrix4();
    const mesh = ref.current;

    if (model.geometry.boundingSphere === null) {
      model.geometry.computeBoundingSphere();
    }

    if (mesh !== null) {
      mesh.boundingSphere = new Sphere();
    }

    return {
      paint: (parking) => {
        if (mesh === null) {
          return;
        }

        const count = Math.min(parking.length, WAREHOUSE_YARD_PARKING_LIMIT);
        let written = 0;
        for (let index = 0; index < count; index += 1) {
          const pose = parking[index];

          if (pose !== undefined) {
            mesh.setMatrixAt(written, matrix.makeTranslation(0, 0, pose.offsetZ));
            written += 1;
          }
        }
        mesh.count = written;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      },
    };
  }, [model.geometry]);

  return (
    <group name="warehouse-yard-parking" position={[dock.x, 0, dock.z + WAREHOUSE_TRUCK_CENTER_Z]}>
      <instancedMesh
        args={[model.geometry, model.material, WAREHOUSE_YARD_PARKING_LIMIT]}
        count={0}
        instanceMatrix-usage={DynamicDrawUsage}
        receiveShadow
        ref={ref}
      />
    </group>
  );
};
