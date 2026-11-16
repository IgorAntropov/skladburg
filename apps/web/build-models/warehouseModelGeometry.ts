import type {
  Box3,
  Matrix4,
} from 'three';

import { readFile } from 'node:fs/promises';
import {
  BufferGeometry,
  Material,
  Mesh,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface MeshValue {
  indices: number[];
  positions: number[];
}

export type TriangleValue = readonly [Vector3, Vector3, Vector3];

interface SourceMeshValue {
  material: string;
  name: string;
  parentName: string;
  triangles: TriangleValue[];
}

export const readTriangles = (geometry: BufferGeometry, transform: Matrix4): TriangleValue[] => {
  const positions = geometry.getAttribute('position');
  const indices = geometry.getIndex();
  const vertexCount = indices?.count ?? positions.count;

  if (vertexCount % 3 !== 0) {
    throw new Error('Warehouse model: expected triangles');
  }

  const isMirrored = transform.determinant() < 0;
  const vertices = new Map<string, Vector3>();
  const getVertex = (offset: number): Vector3 => {
    const position = new Vector3().fromBufferAttribute(positions, indices?.getX(offset) ?? offset).applyMatrix4(transform);
    const key = position.toArray().join(',');
    const previous = vertices.get(key);

    if (previous !== undefined) {
      return previous;
    }

    vertices.set(key, position);

    return position;
  };
  const triangles: TriangleValue[] = [];

  for (let offset = 0; offset < vertexCount; offset += 3) {
    const first = getVertex(offset);
    const second = getVertex(offset + 1);
    const third = getVertex(offset + 2);

    triangles.push(isMirrored ? [first, third, second] : [first, second, third]);
  }

  return triangles;
};

const isBufferGeometry = (geometry: unknown): geometry is BufferGeometry => geometry instanceof BufferGeometry;

export const readWarehouseGlb = async (path: string): Promise<SourceMeshValue[]> => {
  const data = Uint8Array.from(await readFile(path));
  const { scene } = await new GLTFLoader().parseAsync(data.buffer, '');
  const meshes: SourceMeshValue[] = [];

  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    const geometry: unknown = object.geometry;
    const material: unknown = object.material;

    if (!isBufferGeometry(geometry) || !geometry.hasAttribute('position') || !(material instanceof Material)) {
      throw new Error('Warehouse model: expected a positioned mesh with a single material');
    }

    meshes.push({
      material: material.name,
      name: object.name,
      parentName: object.parent?.name ?? '',
      triangles: readTriangles(geometry, object.matrixWorld),
    });
  });

  return meshes;
};

const round = (value: number, scale: number): number => Math.round(value * scale) / scale;

export const toWarehouseMesh = (triangles: readonly TriangleValue[], bounds: Box3 | undefined): MeshValue => {
  const center = bounds?.getCenter(new Vector3()) ?? new Vector3();
  const size = bounds?.getSize(new Vector3()) ?? new Vector3(1, 1, 1);

  if (triangles.length === 0 || size.x <= 0 || size.y <= 0 || size.z <= 0) {
    throw new Error('Warehouse model: expected a nonempty three-dimensional module');
  }

  const mesh: MeshValue = { indices: [], positions: [] };
  const vertexIndices = new Map<string, number>();
  const edge = new Vector3();
  const normal = new Vector3();

  for (const [first, second, third] of triangles) {
    normal.subVectors(second, first).cross(edge.subVectors(third, first)).normalize();

    for (const point of [first, second, third]) {
      const position = new Vector3().subVectors(point, center).divide(size).toArray().map(value => round(value, 100_000));
      const key = [...position, ...normal.toArray().map(value => round(value, 1_000))].join(',');
      const index = vertexIndices.get(key) ?? vertexIndices.size;

      if (!vertexIndices.has(key)) {
        vertexIndices.set(key, index);
        mesh.positions.push(...position);
      }

      mesh.indices.push(index);
    }
  }

  return mesh;
};
