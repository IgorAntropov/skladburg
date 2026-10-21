import type { ReactElement } from 'react';
import type {
  BufferGeometry,
  Material,
} from 'three';

import { useMemo } from 'react';

import { INSTANCE_MATRIX_ITEM_SIZE } from '../geometry/composeInstanceMatrix';

interface InstancedLayerProps {
  count: number;
  geometry: BufferGeometry;
  hasShadowCast: boolean;
  hasShadowReceive: boolean;
  material: Material;
  matrices: Float32Array;
  tints: Float32Array | undefined;
}

const PLACEHOLDER_CAPACITY = 1;
const TINT_ITEM_SIZE = 3;

export const InstancedLayer = ({
  count,
  geometry,
  hasShadowCast,
  hasShadowReceive,
  material,
  matrices,
  tints,
}: InstancedLayerProps): null | ReactElement => {
  const meshArgs = useMemo(
    (): [BufferGeometry, Material, number] => [geometry, material, PLACEHOLDER_CAPACITY],
    [geometry, material],
  );
  const matrixArgs = useMemo((): [Float32Array, number] => [matrices, INSTANCE_MATRIX_ITEM_SIZE], [matrices]);
  const tintArgs = useMemo(
    (): [Float32Array, number] | undefined => tints === undefined ? undefined : [tints, TINT_ITEM_SIZE],
    [tints],
  );

  if (matrices.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      args={meshArgs}
      castShadow={hasShadowCast}
      count={count}
      frustumCulled={false}
      receiveShadow={hasShadowReceive}
    >
      <instancedBufferAttribute args={matrixArgs} attach="instanceMatrix" />
      {tintArgs !== undefined && <instancedBufferAttribute args={tintArgs} attach="instanceColor" />}
    </instancedMesh>
  );
};
