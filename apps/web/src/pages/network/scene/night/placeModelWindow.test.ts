import {
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WorldModelFitValue } from '../models/fitWorldModelToFootprint';
import type { WorldModelWindowValue } from '../models/listWorldModelWindows';
import type { WorldModelFaceValue } from '../models/worldModelCatalog';

import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from '../geometry/composeInstanceMatrix';
import { PLAZA_HEIGHT_METERS } from '../geometry/networkSceneMetrics';
import { WINDOW_STANDOFF_METERS } from './nightConstants';
import { placeModelWindow } from './placeModelWindow';

const ORIGIN = { x: 10, z: -4 };
const FACES: readonly WorldModelFaceValue[] = ['positiveZ', 'positiveX', 'negativeZ', 'negativeX'];
const MODEL_NORMALS: Readonly<Record<WorldModelFaceValue, Vector3>> = {
  negativeX: new Vector3(-1, 0, 0),
  negativeZ: new Vector3(0, 0, -1),
  positiveX: new Vector3(1, 0, 0),
  positiveZ: new Vector3(0, 0, 1),
};
const EPSILON = 1e-6;

const createWindow = (face: WorldModelFaceValue): WorldModelWindowValue => ({
  center: face.endsWith('Z') ? [0.1, 0.3, face === 'positiveZ' ? 0.5 : -0.5] : [face === 'positiveX' ? 0.7 : -0.7, 0.3, -0.2],
  face,
  height: 0.1,
  width: 0.2,
});

const readModelToWorld = (fit: WorldModelFitValue): Matrix4 => new Matrix4().compose(
  new Vector3(ORIGIN.x, PLAZA_HEIGHT_METERS, ORIGIN.z),
  new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), fit.rotationY),
  new Vector3(...fit.scale),
);

describe('placeModelWindow', () => {
  it('puts a window of the unturned model at the scaled place, as wide as the scale of its wall axis', () => {
    const fit: WorldModelFitValue = { rotationY: 0, scale: [2, 1.5, 3] };
    const front = placeModelWindow(createWindow('positiveZ'), fit, ORIGIN);
    const side = placeModelWindow(createWindow('positiveX'), fit, ORIGIN);

    expect(front.rotationY).toBe(0);
    expect(front.scale[0]).toBeCloseTo(0.4, 6);
    expect(front.scale[1]).toBeCloseTo(0.15, 6);
    expect(front.x).toBeCloseTo(10.2, 6);
    expect(front.y).toBeCloseTo(PLAZA_HEIGHT_METERS + 0.45, 6);
    expect(front.z).toBeCloseTo(-4 + 1.5 + WINDOW_STANDOFF_METERS, 6);
    expect(side.rotationY).toBeCloseTo(Math.PI / 2, 6);
    expect(side.scale[0]).toBeCloseTo(0.6, 6);
    expect(side.x).toBeCloseTo(10 + 1.4 + WINDOW_STANDOFF_METERS, 6);
    expect(side.z).toBeCloseTo(-4 - 0.6, 6);
  });

  it('turns the plane with a model that the fit turned by a quarter of a turn, swapping the scale of the axes', () => {
    const fit: WorldModelFitValue = { rotationY: Math.PI / 2, scale: [2, 1.5, 3] };
    const front = placeModelWindow(createWindow('positiveZ'), fit, ORIGIN);

    expect(front.rotationY).toBeCloseTo(Math.PI / 2, 6);
    expect(front.scale[0]).toBeCloseTo(0.4, 6);
    expect(front.x).toBeCloseTo(10 + 1.5 + WINDOW_STANDOFF_METERS, 6);
    expect(front.z).toBeCloseTo(-4 - 0.2, 6);
  });

  it.each([0, 0.7, Math.PI / 2, 2.3, -1.9])('keeps the plane at the standoff from the face, facing out, at rotation %f', (rotationY) => {
    const fit: WorldModelFitValue = { rotationY, scale: [1.3, 1.1, 2.1] };
    const toWorld = readModelToWorld(fit);

    for (const face of FACES) {
      const window = createWindow(face);
      const transform = placeModelWindow(window, fit, ORIGIN);
      const elements = new Float32Array(INSTANCE_MATRIX_ITEM_SIZE);

      writeInstanceMatrix(elements, 0, transform);

      const matrix = new Matrix4().fromArray(elements);

      const onFace = new Vector3(...window.center).applyMatrix4(toWorld);
      const normal = MODEL_NORMALS[face].clone().transformDirection(toWorld);
      const planeNormal = new Vector3(0, 0, 1).transformDirection(matrix);
      const planePosition = new Vector3().setFromMatrixPosition(matrix);
      const offset = planePosition.clone().sub(onFace);

      expect(planeNormal.distanceTo(normal)).toBeLessThan(EPSILON);
      expect(offset.dot(normal)).toBeCloseTo(WINDOW_STANDOFF_METERS, 5);
      expect(offset.clone().addScaledVector(normal, -WINDOW_STANDOFF_METERS).length()).toBeLessThan(EPSILON);
    }
  });
});
