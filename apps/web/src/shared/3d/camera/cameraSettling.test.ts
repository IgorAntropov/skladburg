import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  ISOMETRIC_AZIMUTH_RADIANS,
  ISOMETRIC_POLAR_RADIANS,
  MAX_FRAME_DELTA_S,
} from './cameraConstants';
import {
  isAngleSettled,
  isPointSettled,
  isZoomSettled,
  limitFrameDelta,
  shiftPointToGround,
} from './cameraSettling';

describe('limitFrameDelta', () => {
  it('passes a normal frame through', () => {
    expect(limitFrameDelta(0.016)).toBe(0.016);
  });

  it('caps the step after an idle pause so the first frame does not jump', () => {
    expect(limitFrameDelta(2.5)).toBe(MAX_FRAME_DELTA_S);
  });

  it('never goes negative', () => {
    expect(limitFrameDelta(-1)).toBe(0);
  });
});

describe('settling', () => {
  it('settles angles, zoom and points only when the remaining distance cannot be seen', () => {
    expect(isAngleSettled(1, 1 + 5e-5)).toBe(true);
    expect(isAngleSettled(1, 1.01)).toBe(false);
    expect(isZoomSettled(100, 100.005)).toBe(true);
    expect(isZoomSettled(100, 101)).toBe(false);
    expect(isPointSettled({ x: 0, y: 0, z: 0 }, { x: 1e-4, y: 0, z: 1e-4 })).toBe(true);
    expect(isPointSettled({ x: 0, y: 0, z: 0 }, { x: 0.05, y: 0, z: 0 })).toBe(false);
  });
});

describe('shiftPointToGround', () => {
  const offset = { phi: ISOMETRIC_POLAR_RADIANS, radius: 40, theta: ISOMETRIC_AZIMUTH_RADIANS };

  it('leaves a point that is already on the ground untouched', () => {
    const point = { x: 3, y: -0.24, z: 5 };

    shiftPointToGround(point, offset, -0.24);

    expect(point).toEqual({ x: 3, y: -0.24, z: 5 });
  });

  it('moves a lifted point to the ground along the viewing direction', () => {
    const point = { x: 3, y: 1.5, z: 5 };

    shiftPointToGround(point, offset, 0);

    expect(point.y).toBe(0);

    const horizontalPerHeight = Math.tan(ISOMETRIC_POLAR_RADIANS);

    expect(point.x - 3).toBeCloseTo(-1.5 * horizontalPerHeight * Math.sin(ISOMETRIC_AZIMUTH_RADIANS), 9);
    expect(point.z - 5).toBeCloseTo(-1.5 * horizontalPerHeight * Math.cos(ISOMETRIC_AZIMUTH_RADIANS), 9);
  });

  it('keeps the point on the same line of sight', () => {
    const point = { x: 3, y: 1.5, z: 5 };
    const start = { ...point };

    shiftPointToGround(point, offset, -0.4);

    const shiftX = point.x - start.x;
    const shiftY = point.y - start.y;
    const shiftZ = point.z - start.z;
    const sightX = offset.radius * Math.sin(offset.phi) * Math.sin(offset.theta);
    const sightY = offset.radius * Math.cos(offset.phi);
    const sightZ = offset.radius * Math.sin(offset.phi) * Math.cos(offset.theta);
    const scale = shiftY / sightY;

    expect(shiftX).toBeCloseTo(sightX * scale, 9);
    expect(shiftZ).toBeCloseTo(sightZ * scale, 9);
  });

  it('does nothing for a camera looking along the ground', () => {
    const point = { x: 0, y: 2, z: 0 };

    shiftPointToGround(point, { phi: Math.PI / 2, radius: 10, theta: 0 }, 0);

    expect(point).toEqual({ x: 0, y: 2, z: 0 });
  });
});
