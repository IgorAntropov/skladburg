import {
  BufferAttribute,
  BufferGeometry,
} from 'three';

type PointValue = readonly [number, number, number];

const FRONT_LEFT: PointValue = [-0.5, 0, -0.5];
const FRONT_RIGHT: PointValue = [0.5, 0, -0.5];
const BACK_RIGHT: PointValue = [0.5, 0, 0.5];
const BACK_LEFT: PointValue = [-0.5, 0, 0.5];
const RIDGE_LEFT: PointValue = [-0.5, 1, 0];
const RIDGE_RIGHT: PointValue = [0.5, 1, 0];

const TRIANGLES: readonly (readonly [PointValue, PointValue, PointValue])[] = [
  [FRONT_LEFT, RIDGE_RIGHT, FRONT_RIGHT],
  [FRONT_LEFT, RIDGE_LEFT, RIDGE_RIGHT],
  [BACK_RIGHT, RIDGE_LEFT, BACK_LEFT],
  [BACK_RIGHT, RIDGE_RIGHT, RIDGE_LEFT],
  [FRONT_LEFT, BACK_LEFT, RIDGE_LEFT],
  [FRONT_RIGHT, RIDGE_RIGHT, BACK_RIGHT],
];

const VECTOR_ITEM_SIZE = 3;

export const createGablePrismGeometry = (): BufferGeometry => {
  const positions = new Float32Array(TRIANGLES.length * VECTOR_ITEM_SIZE * VECTOR_ITEM_SIZE);

  for (const [triangleIndex, triangle] of TRIANGLES.entries()) {
    for (const [pointIndex, point] of triangle.entries()) {
      positions.set(point, (triangleIndex * VECTOR_ITEM_SIZE + pointIndex) * VECTOR_ITEM_SIZE);
    }
  }

  const geometry = new BufferGeometry();

  geometry.setAttribute('position', new BufferAttribute(positions, VECTOR_ITEM_SIZE));
  geometry.computeVertexNormals();

  return geometry;
};
