import {
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  applyChipAzimuth,
  getCameraAzimuth,
} from './chipOrientation';

const ELEVATION = Math.atan(1 / Math.SQRT2);

const createCameraRotation = (azimuth: number): Quaternion =>
  new Quaternion().setFromEuler(new Euler(-ELEVATION, azimuth, 0, 'YXZ'));

describe('getCameraAzimuth', () => {
  it('reads the yaw of an isometric camera for the four quarter turns', () => {
    for (const azimuth of [Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4, (-3 * Math.PI) / 4, 0]) {
      expect(getCameraAzimuth(createCameraRotation(azimuth))).toBeCloseTo(azimuth, 6);
    }
  });

  it('matches the horizontal direction from the scene to the camera', () => {
    const rotation = createCameraRotation(Math.PI / 4);
    const backward = new Vector3(0, 0, 1).applyQuaternion(rotation);
    const azimuth = getCameraAzimuth(rotation);

    expect(Math.sin(azimuth)).toBeCloseTo(backward.x / Math.hypot(backward.x, backward.z), 6);
    expect(Math.cos(azimuth)).toBeCloseTo(backward.z / Math.hypot(backward.x, backward.z), 6);
  });

  it('gives zero for a camera that is not turned', () => {
    expect(getCameraAzimuth({ w: 1, x: 0, y: 0, z: 0 })).toBe(0);
  });
});

describe('applyChipAzimuth', () => {
  const createMatrices = (): Float32Array => {
    const matrices = new Float32Array(32);

    matrices.set([4, 3.7, -9], 12);
    matrices.set([-7, 3.7, 2], 28);

    return matrices;
  };

  it('turns the front of the plate to the camera and stretches it upright', () => {
    const matrices = createMatrices();

    applyChipAzimuth(matrices, 2, Math.PI / 4, undefined);

    const matrix = new Matrix4().fromArray(matrices, 0);
    const front = new Vector3(0, 0, 1).transformDirection(matrix);
    const up = new Vector3(0, 1, 0).applyMatrix4(new Matrix4().extractRotation(matrix));

    expect(front.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(front.y).toBeCloseTo(0, 6);
    expect(front.z).toBeCloseTo(Math.SQRT1_2, 6);
    expect(up.y).toBeCloseTo(1, 6);
    expect(new Vector3().setFromMatrixScale(matrix).y).toBeCloseTo(1.2247449, 6);
    expect(new Vector3().setFromMatrixScale(matrix).x).toBeCloseTo(1, 6);
  });

  it('keeps the position of every plate while it turns', () => {
    const matrices = createMatrices();

    applyChipAzimuth(matrices, 2, 1.1, undefined);
    applyChipAzimuth(matrices, 2, -2.3, undefined);

    [4, 3.7, -9].forEach((value, axis) => {
      expect(matrices[12 + axis]).toBeCloseTo(value, 5);
    });
    [-7, 3.7, 2].forEach((value, axis) => {
      expect(matrices[28 + axis]).toBeCloseTo(value, 5);
    });
    expect(matrices[15]).toBe(1);
    expect(matrices[31]).toBe(1);
  });

  it('touches only the first count plates', () => {
    const matrices = createMatrices();

    applyChipAzimuth(matrices, 1, 0.5, undefined);

    expect(matrices[16]).toBe(0);
  });

  it('grows only the hovered plate 1.25 times around its center and lifts it by 0.4 m', () => {
    const matrices = createMatrices();

    applyChipAzimuth(matrices, 2, 0.7, 1);

    const calm = new Matrix4().fromArray(matrices, 0);
    const hovered = new Matrix4().fromArray(matrices, 16);

    expect(new Vector3().setFromMatrixScale(calm).x).toBeCloseTo(1, 6);
    expect(new Vector3().setFromMatrixScale(hovered).x).toBeCloseTo(1.25, 6);
    expect(new Vector3().setFromMatrixScale(hovered).y).toBeCloseTo(1.25 * 1.2247449, 6);
    expect(new Vector3().setFromMatrixScale(hovered).z).toBeCloseTo(1.25, 6);
    expect(matrices[13]).toBeCloseTo(3.7, 6);
    expect(matrices[29]).toBeCloseTo(4.1, 6);
    expect(matrices[28]).toBeCloseTo(-7, 6);
    expect(matrices[30]).toBeCloseTo(2, 6);
  });

  it('returns the plate to its size and height when it is no longer hovered', () => {
    const matrices = createMatrices();

    applyChipAzimuth(matrices, 2, 0.7, 1);
    applyChipAzimuth(matrices, 2, 0.7, undefined);

    expect(matrices[29]).toBeCloseTo(3.7, 6);
    expect(new Vector3().setFromMatrixScale(new Matrix4().fromArray(matrices, 16)).x).toBeCloseTo(1, 6);
  });
});
