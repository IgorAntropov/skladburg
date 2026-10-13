import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  MAX_ZOOM_FACTOR,
  ZOOM_STEP_FACTOR,
} from './cameraConstants';
import {
  getZoomLimits,
  isViewAtFit,
  stepZoom,
} from './cameraZoom';

const FIT = { target: { x: 0, y: -0.24, z: 0 }, zoom: 40 };

describe('getZoomLimits', () => {
  it('ranges from the whole board to the maximum factor of it', () => {
    expect(getZoomLimits(40)).toEqual({ max: 40 * MAX_ZOOM_FACTOR, min: 40 });
  });
});

describe('stepZoom', () => {
  it('multiplies by the step factor in and divides by it out', () => {
    expect(stepZoom(40, 1)).toBeCloseTo(40 * ZOOM_STEP_FACTOR, 9);
    expect(stepZoom(40, -1)).toBeCloseTo(40 / ZOOM_STEP_FACTOR, 9);
  });

  it('returns to the start after a step in and a step out', () => {
    expect(stepZoom(stepZoom(40, 1), -1)).toBeCloseTo(40, 9);
  });
});

describe('isViewAtFit', () => {
  it('recognizes the framing the fit gave', () => {
    expect(isViewAtFit({ fit: FIT, target: { x: 0, y: -0.24, z: 0 }, zoom: 40 })).toBe(true);
  });

  it('tolerates a rounding difference in zoom and target', () => {
    expect(isViewAtFit({ fit: FIT, target: { x: 0.001, y: -0.24, z: -0.002 }, zoom: 40.0001 })).toBe(true);
  });

  it('is not at fit once zoomed in or panned away', () => {
    expect(isViewAtFit({ fit: FIT, target: FIT.target, zoom: 60 })).toBe(false);
    expect(isViewAtFit({ fit: FIT, target: { x: 1, y: -0.24, z: 0 }, zoom: 40 })).toBe(false);
  });

  it('ignores the height of the target', () => {
    expect(isViewAtFit({ fit: FIT, target: { x: 0, y: 3, z: 0 }, zoom: 40 })).toBe(true);
  });
});
