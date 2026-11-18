import type { ThreeEvent } from '@react-three/fiber';
import type { ReactElement } from 'react';
import type {
  BufferGeometry,
  InstancedMesh,
} from 'three';

import { useThree } from '@react-three/fiber';
import {
  useLayoutEffect,
  useRef,
} from 'react';
import { Matrix4 } from 'three';

import type { WorldPaletteKeyValue } from '@/shared/3d';

import { useWorldMaterial } from '@/shared/3d';

import type { WarehouseBoxValue } from './warehouseLayout';

export interface WarehouseInstancesProps {
  boxes: readonly WarehouseBoxValue[];
  geometry: BufferGeometry;
  isShadowed?: boolean | undefined;
  materialKey: WorldPaletteKeyValue;
  onClick?: ((event: ThreeEvent<MouseEvent>) => void) | undefined;
}

export const WarehouseInstances = ({
  boxes, geometry, isShadowed = false, materialKey, onClick,
}: WarehouseInstancesProps): null | ReactElement => {
  const material = useWorldMaterial(materialKey);
  const invalidate = useThree(state => state.invalidate);
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (mesh === null) {
      return;
    }
    const matrix = new Matrix4();
    for (const [index, { position, size }] of boxes.entries()) {
      matrix.makeScale(...size).setPosition(...position);
      mesh.setMatrixAt(index, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
  }, [boxes, geometry, invalidate, material]);

  if (boxes.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      args={[geometry, material, boxes.length]}
      castShadow={isShadowed}
      onClick={onClick}
      receiveShadow
      ref={ref}
    />
  );
};
