import {
  describe,
  expect,
  it,
} from 'vitest';

import { ZOOM_STEP_FACTOR } from './cameraConstants';
import {
  isViewAtHome,
  stepZoom,
} from './cameraZoom';

const HOME = { target: { x: 0, y: 0, z: 0 }, zoom: 40 };

describe('stepZoom', () => {
  it('multiplies by the step factor in and divides by it out', () => {
    expect(stepZoom(40, 1)).toBeCloseTo(40 * ZOOM_STEP_FACTOR, 9);
    expect(stepZoom(40, -1)).toBeCloseTo(40 / ZOOM_STEP_FACTOR, 9);
  });

  it('returns to the start after a step in and a step out', () => {
    expect(stepZoom(stepZoom(40, 1), -1)).toBeCloseTo(40, 9);
  });
});

describe('isViewAtHome', () => {
  it('recognizes the framing the home view gave', () => {
    expect(isViewAtHome({ home: HOME, target: { x: 0, y: 0, z: 0 }, zoom: 40 })).toBe(true);
  });

  it('tolerates a rounding difference in zoom and target', () => {
    expect(isViewAtHome({ home: HOME, target: { x: 0.001, y: 0, z: -0.002 }, zoom: 40.0001 })).toBe(true);
  });

  it('is not at home once zoomed or panned away', () => {
    expect(isViewAtHome({ home: HOME, target: HOME.target, zoom: 60 })).toBe(false);
    expect(isViewAtHome({ home: HOME, target: { x: 1, y: 0, z: 0 }, zoom: 40 })).toBe(false);
  });

  it('ignores the height of the target', () => {
    expect(isViewAtHome({ home: HOME, target: { x: 0, y: 3, z: 0 }, zoom: 40 })).toBe(true);
  });
});
