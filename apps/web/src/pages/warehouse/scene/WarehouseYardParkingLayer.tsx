import type {
  ReactElement,
  RefObject,
} from 'react';
import type {
  BoxGeometry,
  InstancedMesh,
} from 'three';

import {
  createRef,
  useImperativeHandle,
  useMemo,
} from 'react';
import {
  Box3,
  DynamicDrawUsage,
  Matrix4,
  Sphere,
} from 'three';

import type { WorldPaletteKeyValue } from '@/shared/3d';

import { useWorldMaterial } from '@/shared/3d';

import type {
  WarehouseBoxValue,
  WarehouseLayoutValue,
} from './warehouseLayout';

import { WAREHOUSE_YARD_PARKING_LIMIT } from './warehouseYardParking';

export interface WarehouseYardParkingRigValue {
  paint: (parking: readonly { offsetZ: number }[]) => void;
}

interface WarehouseParkingBatchProps {
  boxes: readonly WarehouseBoxValue[];
  geometry: BoxGeometry;
  materialKey: WorldPaletteKeyValue;
  mesh: RefObject<InstancedMesh | null>;
}

interface WarehouseYardParkingProps {
  geometry: BoxGeometry;
  rig: RefObject<null | WarehouseYardParkingRigValue>;
  trucks: WarehouseLayoutValue['truck'];
}

const WarehouseParkingBatch = ({ boxes, geometry, materialKey, mesh }: WarehouseParkingBatchProps): ReactElement => {
  const material = useWorldMaterial(materialKey);

  return (
    <instancedMesh
      args={[geometry, material, boxes.length * WAREHOUSE_YARD_PARKING_LIMIT]}
      count={0}
      instanceMatrix-usage={DynamicDrawUsage}
      receiveShadow
      ref={mesh}
    />
  );
};

export const WarehouseYardParking = ({ geometry, rig, trucks }: WarehouseYardParkingProps): ReactElement => {
  const batches = useMemo(
    () => Array.from(trucks, ([materialKey, boxes]) => ({ boxes, materialKey, ref: createRef<InstancedMesh>() })),
    [trucks],
  );

  useImperativeHandle(rig, (): WarehouseYardParkingRigValue => {
    const matrix = new Matrix4();
    const mounted = batches.flatMap(({ boxes, ref }) => {
      const mesh = ref.current;
      if (mesh === null) {
        return [];
      }

      const bounds = new Box3();
      const sphere = new Sphere();
      mesh.boundingBox = bounds;
      mesh.boundingSphere = sphere;

      return [{ bounds, boxes, mesh, sphere }];
    });

    if (geometry.boundingBox === null) {
      geometry.computeBoundingBox();
    }

    return {
      paint: (parking) => {
        const count = Math.min(parking.length, WAREHOUSE_YARD_PARKING_LIMIT);
        let batchIndex = 0;

        while (batchIndex < mounted.length) {
          const batch = mounted[batchIndex];
          batchIndex += 1;
          if (batch === undefined) {
            continue;
          }

          const { bounds, boxes, mesh, sphere } = batch;
          let countWritten = 0;
          for (let truckIndex = 0; truckIndex < count; truckIndex += 1) {
            const pose = parking[truckIndex];
            if (pose === undefined) {
              continue;
            }

            let partIndex = 0;
            while (partIndex < boxes.length) {
              const part = boxes[partIndex];
              partIndex += 1;
              if (part === undefined) {
                continue;
              }

              const { position, size } = part;
              matrix.makeScale(size[0], size[1], size[2]).setPosition(position[0], position[1], position[2] + pose.offsetZ);
              mesh.setMatrixAt(countWritten, matrix);
              countWritten += 1;
            }
          }
          mesh.count = countWritten;
          mesh.instanceMatrix.needsUpdate = true;
          mesh.computeBoundingBox();
          bounds.getBoundingSphere(sphere);
        }
      },
    };
  }, [batches, geometry]);

  return (
    <group name="warehouse-yard-parking">
      {batches.map(({ boxes, materialKey, ref }) => (
        <WarehouseParkingBatch boxes={boxes} geometry={geometry} key={materialKey} materialKey={materialKey} mesh={ref} />
      ))}
    </group>
  );
};
