import { OrthographicCamera } from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createScreenPoint,
  projectWorldPointToScreen,
} from './projectWorldPointToScreen';

const SIZE = { height: 600, width: 800 };

const createCamera = (): OrthographicCamera => {
  const camera = new OrthographicCamera(-400, 400, 300, -300, 0.1, 100);

  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  return camera;
};

describe('projectWorldPointToScreen', () => {
  it('puts the look-at point to the middle of the screen', () => {
    const point = projectWorldPointToScreen({ x: 0, y: 0, z: 0 }, createCamera(), SIZE, createScreenPoint());

    expect(point.x).toBeCloseTo(400);
    expect(point.y).toBeCloseTo(300);
    expect(point.isVisible).toBe(true);
  });

  it('counts pixels from the top-left corner with y growing downward', () => {
    const point = projectWorldPointToScreen({ x: 100, y: 50, z: 0 }, createCamera(), SIZE, createScreenPoint());

    expect(point.x).toBeCloseTo(500);
    expect(point.y).toBeCloseTo(250);
  });

  it('hides a point behind the camera and a point beyond the far plane', () => {
    const camera = createCamera();

    expect(projectWorldPointToScreen({ x: 0, y: 0, z: 20 }, camera, SIZE, createScreenPoint()).isVisible).toBe(false);
    expect(projectWorldPointToScreen({ x: 0, y: 0, z: -200 }, camera, SIZE, createScreenPoint()).isVisible).toBe(false);
  });

  it('writes into the given object and returns it', () => {
    const out = createScreenPoint();

    expect(projectWorldPointToScreen({ x: 0, y: 0, z: 0 }, createCamera(), SIZE, out)).toBe(out);
  });
});
