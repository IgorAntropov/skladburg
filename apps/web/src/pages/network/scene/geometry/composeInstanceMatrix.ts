import {
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';

const MATRIX_ITEM_SIZE = 16;
const Y_AXIS = new Vector3(0, 1, 0);

const scratchMatrix = new Matrix4();
const scratchPosition = new Vector3();
const scratchQuaternion = new Quaternion();
const scratchScale = new Vector3();

export interface InstanceTransformValue {
  rotationY: number;
  scale: readonly [number, number, number];
  x: number;
  y: number;
  z: number;
}

export const INSTANCE_MATRIX_ITEM_SIZE = MATRIX_ITEM_SIZE;

export const writeInstanceMatrix = (target: Float32Array, index: number, transform: InstanceTransformValue): void => {
  scratchPosition.set(transform.x, transform.y, transform.z);
  scratchQuaternion.setFromAxisAngle(Y_AXIS, transform.rotationY);
  scratchScale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
  scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
  scratchMatrix.toArray(target, index * MATRIX_ITEM_SIZE);
};
