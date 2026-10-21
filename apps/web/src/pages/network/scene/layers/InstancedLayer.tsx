import type { ReactElement } from 'react';
import type {
  BufferGeometry,
  Material,
} from 'three';

import {
  useEffect,
  useMemo,
} from 'react';

import { INSTANCE_MATRIX_ITEM_SIZE } from '../geometry/composeInstanceMatrix';
import { createGlowDelayGeometry } from '../geometry/createGlowDelayGeometry';

interface InstancedLayerProps {
  count: number;
  delays: Float32Array | undefined;
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
  delays,
  geometry,
  hasShadowCast,
  hasShadowReceive,
  material,
  matrices,
  tints,
}: InstancedLayerProps): null | ReactElement => {
  const layerGeometry = useMemo(
    (): BufferGeometry => delays === undefined ? geometry : createGlowDelayGeometry(geometry, delays),
    [delays, geometry],
  );
  const meshArgs = useMemo(
    (): [BufferGeometry, Material, number] => [layerGeometry, material, PLACEHOLDER_CAPACITY],
    [layerGeometry, material],
  );
  const matrixArgs = useMemo((): [Float32Array, number] => [matrices, INSTANCE_MATRIX_ITEM_SIZE], [matrices]);
  const tintArgs = useMemo(
    (): [Float32Array, number] | undefined => tints === undefined ? undefined : [tints, TINT_ITEM_SIZE],
    [tints],
  );

  useEffect(() => {
    return () => {
      if (layerGeometry !== geometry) {
        layerGeometry.dispose();
      }
    };
  }, [geometry, layerGeometry]);

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
