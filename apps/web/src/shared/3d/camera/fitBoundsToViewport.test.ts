import {
  OrthographicCamera,
  Vector3,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { SceneBoundsValue } from '../world/sceneBounds';
import type {
  IsometricFitValue,
  ViewportSizeValue,
} from './fitBoundsToViewport';

import {
  DEFAULT_FIT_MARGIN_RATIO,
  fitBoundsToViewport,
  ISOMETRIC_AZIMUTH_RADIANS,
  ISOMETRIC_ELEVATION_RADIANS,
} from './fitBoundsToViewport';

interface NdcExtentsValue {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

const projectBounds = (
  bounds: SceneBoundsValue,
  viewport: ViewportSizeValue,
  fit: IsometricFitValue,
): NdcExtentsValue => {
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;
  const camera = new OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, fit.near, fit.far);
  camera.position.set(...fit.position);
  camera.zoom = fit.zoom;
  camera.lookAt(...fit.target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  const corners: readonly (readonly [number, number])[] = [
    [bounds.minX, bounds.minZ],
    [bounds.minX, bounds.maxZ],
    [bounds.maxX, bounds.minZ],
    [bounds.maxX, bounds.maxZ],
  ];
  const projected = corners.map(([x, z]) => new Vector3(x, 0, z).project(camera));

  return {
    maxX: Math.max(...projected.map(point => point.x)),
    maxY: Math.max(...projected.map(point => point.y)),
    minX: Math.min(...projected.map(point => point.x)),
    minY: Math.min(...projected.map(point => point.y)),
  };
};

const SQUARE_BOUNDS: SceneBoundsValue = {
  maxX: 5,
  maxZ: 5,
  minX: -5,
  minZ: -5,
};

const OFF_CENTER_WIDE_BOUNDS: SceneBoundsValue = {
  maxX: 40,
  maxZ: 18,
  minX: 10,
  minZ: 2,
};

const USABLE_SHARE = 1 - 2 * DEFAULT_FIT_MARGIN_RATIO;
const PRECISION = 6;

describe('fitBoundsToViewport', () => {
  it('uses the true isometric elevation and a 45 degree azimuth', () => {
    expect(ISOMETRIC_AZIMUTH_RADIANS).toBeCloseTo(Math.PI / 4, PRECISION);
    expect((ISOMETRIC_ELEVATION_RADIANS * 180) / Math.PI).toBeCloseTo(35.264, 3);
  });

  it('looks at the center of the bounds from equal offsets along both ground axes', () => {
    const fit = fitBoundsToViewport({ bounds: OFF_CENTER_WIDE_BOUNDS, viewport: { height: 600, width: 800 } });

    expect(fit.target).toEqual([25, 0, 10]);
    expect(fit.position[0] - fit.target[0]).toBeCloseTo(fit.position[2] - fit.target[2], PRECISION);
    expect(fit.position[1]).toBeGreaterThan(0);
  });

  it.each([
    ['wide', { height: 400, width: 1200 }],
    ['tall', { height: 1000, width: 400 }],
    ['square', { height: 700, width: 700 }],
  ])('keeps the whole bounds inside a %s viewport, touching the margin on the tight axis', (_, viewport) => {
    [SQUARE_BOUNDS, OFF_CENTER_WIDE_BOUNDS].forEach((bounds) => {
      const fit = fitBoundsToViewport({ bounds, viewport });
      const extents = projectBounds(bounds, viewport, fit);
      const widestNdc = Math.max(extents.maxX, -extents.minX);
      const tallestNdc = Math.max(extents.maxY, -extents.minY);

      expect(widestNdc).toBeLessThanOrEqual(USABLE_SHARE + 1e-9);
      expect(tallestNdc).toBeLessThanOrEqual(USABLE_SHARE + 1e-9);
      expect(Math.max(widestNdc, tallestNdc)).toBeCloseTo(USABLE_SHARE, PRECISION);
      expect(extents.maxX).toBeCloseTo(-extents.minX, PRECISION);
      expect(extents.maxY).toBeCloseTo(-extents.minY, PRECISION);
    });
  });

  it('zooms in proportionally to the viewport size', () => {
    const small = fitBoundsToViewport({ bounds: SQUARE_BOUNDS, viewport: { height: 300, width: 500 } });
    const large = fitBoundsToViewport({ bounds: SQUARE_BOUNDS, viewport: { height: 600, width: 1000 } });

    expect(large.zoom).toBeCloseTo(small.zoom * 2, PRECISION);
  });

  it('leaves a bigger margin when asked and clamps absurd margins', () => {
    const viewport = { height: 600, width: 1000 };
    const defaultFit = fitBoundsToViewport({ bounds: SQUARE_BOUNDS, viewport });
    const roomyFit = fitBoundsToViewport({ bounds: SQUARE_BOUNDS, marginRatio: 0.2, viewport });
    const absurdFit = fitBoundsToViewport({ bounds: SQUARE_BOUNDS, marginRatio: 5, viewport });

    expect(roomyFit.zoom).toBeLessThan(defaultFit.zoom);
    expect(absurdFit.zoom).toBeGreaterThan(0);
  });

  it('keeps the clipping range around the board and stays finite for degenerate input', () => {
    const fit = fitBoundsToViewport({ bounds: OFF_CENTER_WIDE_BOUNDS, viewport: { height: 600, width: 800 } });
    const distance = Math.hypot(
      fit.position[0] - fit.target[0],
      fit.position[1] - fit.target[1],
      fit.position[2] - fit.target[2],
    );
    const degenerate = fitBoundsToViewport({
      bounds: {
        maxX: 3,
        maxZ: 3,
        minX: 3,
        minZ: 3,
      },
      viewport: { height: 0, width: 0 },
    });

    expect(fit.near).toBeLessThan(distance);
    expect(fit.far).toBeGreaterThan(distance + 20);
    expect(Number.isFinite(degenerate.zoom)).toBe(true);
    expect(degenerate.zoom).toBeGreaterThan(0);
  });
});
