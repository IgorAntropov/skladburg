import type { ReactElement } from 'react';
import type {
  BufferGeometry,
  MeshStandardMaterial,
} from 'three';

import { useMemo } from 'react';

import type { TerrainDecorPartValue } from './terrainDecorParts';
import type { TerrainDecorValue } from './terrainTypes';

import { useWorldGeometry } from '../geometry/useWorldGeometry';
import { useWorldMaterial } from '../materials/useWorldMaterial';
import { skipRaycast } from './skipRaycast';

interface DecorInstancedMeshProps {
  count: number;
  decor: TerrainDecorValue;
  part: TerrainDecorPartValue;
}

const PLACEHOLDER_CAPACITY = 1;
const MATRIX_ITEM_SIZE = 16;
const TINT_ITEM_SIZE = 3;

export const DecorInstancedMesh = ({ count, decor, part }: DecorInstancedMeshProps): ReactElement => {
  const geometry = useWorldGeometry(part.geometry);
  const material = useWorldMaterial(part.material);

  const meshArgs = useMemo(
    (): [BufferGeometry, MeshStandardMaterial, number] => [geometry, material, PLACEHOLDER_CAPACITY],
    [geometry, material],
  );
  const matrixArgs = useMemo((): [Float32Array, number] => [decor.matrices, MATRIX_ITEM_SIZE], [decor.matrices]);
  const tintArgs = useMemo((): [Float32Array, number] => [decor.tints, TINT_ITEM_SIZE], [decor.tints]);

  return (
    <instancedMesh args={meshArgs} count={count} frustumCulled={false} raycast={skipRaycast}>
      <instancedBufferAttribute args={matrixArgs} attach="instanceMatrix" />
      <instancedBufferAttribute args={tintArgs} attach="instanceColor" />
    </instancedMesh>
  );
};
