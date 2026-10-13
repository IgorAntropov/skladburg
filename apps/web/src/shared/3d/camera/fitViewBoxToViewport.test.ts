import {
  OrthographicCamera,
  Vector3,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { SceneViewBoxValue } from '../world/sceneBounds';
import type {
  CameraFitValue,
  ViewportSizeValue,
} from './cameraTypes';

import {
  DEFAULT_FIT_MARGIN_RATIO,
  ISOMETRIC_AZIMUTH_RADIANS,
  ISOMETRIC_ELEVATION_RADIANS,
  QUARTER_TURN_RADIANS,
} from './cameraConstants';
import {
  fitViewBoxToViewport,
  getCameraClipping,
} from './fitViewBoxToViewport';

interface NdcExtentsValue {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

const projectViewBox = (
  viewBox: SceneViewBoxValue,
  viewport: ViewportSizeValue,
  fit: CameraFitValue,
  azimuth: number = ISOMETRIC_AZIMUTH_RADIANS,
): NdcExtentsValue => {
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;
  const clipping = getCameraClipping(viewBox);
  const camera = new OrthographicCamera(-halfWidth, halfWidth, halfHeight, -halfHeight, clipping.near, clipping.far);
  camera.position.set(
    fit.target.x + clipping.distance * Math.cos(ISOMETRIC_ELEVATION_RADIANS) * Math.sin(azimuth),
    fit.target.y + clipping.distance * Math.sin(ISOMETRIC_ELEVATION_RADIANS),
    fit.target.z + clipping.distance * Math.cos(ISOMETRIC_ELEVATION_RADIANS) * Math.cos(azimuth),
  );
  camera.zoom = fit.zoom;
  camera.lookAt(fit.target.x, fit.target.y, fit.target.z);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  const corners: Vector3[] = [];

  [viewBox.minX, viewBox.maxX].forEach((x) => {
    [viewBox.minY, viewBox.maxY].forEach((y) => {
      [viewBox.minZ, viewBox.maxZ].forEach((z) => {
        corners.push(new Vector3(x, y, z));
      });
    });
  });

  const projected = corners.map(corner => corner.project(camera));

  return {
    maxX: Math.max(...projected.map(point => point.x)),
    maxY: Math.max(...projected.map(point => point.y)),
    minX: Math.min(...projected.map(point => point.x)),
    minY: Math.min(...projected.map(point => point.y)),
  };
};

const FLAT_VIEW_BOX: SceneViewBoxValue = {
  maxX: 5,
  maxY: 0,
  maxZ: 5,
  minX: -5,
  minY: 0,
  minZ: -5,
};

const BOARD_VIEW_BOX: SceneViewBoxValue = {
  maxX: 12.55,
  maxY: 0.12,
  maxZ: 8.55,
  minX: -12.55,
  minY: -0.6,
  minZ: -8.55,
};

const OFF_CENTER_TALL_VIEW_BOX: SceneViewBoxValue = {
  maxX: 40,
  maxY: 6,
  maxZ: 18,
  minX: 10,
  minY: -1,
  minZ: 2,
};

const VIEW_BOXES = [FLAT_VIEW_BOX, BOARD_VIEW_BOX, OFF_CENTER_TALL_VIEW_BOX];

const USABLE_SHARE = 1 - 2 * DEFAULT_FIT_MARGIN_RATIO;
const PRECISION = 6;

describe('fitViewBoxToViewport', () => {
  it('uses the true isometric elevation and a 45 degree azimuth', () => {
    expect(ISOMETRIC_AZIMUTH_RADIANS).toBeCloseTo(Math.PI / 4, PRECISION);
    expect((ISOMETRIC_ELEVATION_RADIANS * 180) / Math.PI).toBeCloseTo(35.264, 3);
  });

  it('looks at the center of the box', () => {
    const fit = fitViewBoxToViewport({ viewBox: OFF_CENTER_TALL_VIEW_BOX, viewport: { height: 600, width: 800 } });

    expect(fit.target).toEqual({ x: 25, y: 2.5, z: 10 });
  });

  it.each([
    ['wide', { height: 400, width: 1200 }],
    ['tall', { height: 1000, width: 400 }],
    ['square', { height: 700, width: 700 }],
  ])('keeps all eight corners inside a %s viewport and leaves exactly the margin on the tight axis', (_, viewport) => {
    VIEW_BOXES.forEach((viewBox) => {
      const fit = fitViewBoxToViewport({ viewBox, viewport });
      const extents = projectViewBox(viewBox, viewport, fit);
      const widestNdc = Math.max(extents.maxX, -extents.minX);
      const tallestNdc = Math.max(extents.maxY, -extents.minY);

      expect(widestNdc).toBeLessThanOrEqual(USABLE_SHARE + 1e-9);
      expect(tallestNdc).toBeLessThanOrEqual(USABLE_SHARE + 1e-9);
      expect(Math.max(widestNdc, tallestNdc)).toBeCloseTo(USABLE_SHARE, PRECISION);
      expect(extents.maxX).toBeCloseTo(-extents.minX, PRECISION);
      expect(extents.maxY).toBeCloseTo(-extents.minY, PRECISION);
    });
  });

  it('counts the rim and the thickness of the board in the fit', () => {
    const viewport = { height: 900, width: 1440 };
    const fitWithThickness = fitViewBoxToViewport({ viewBox: BOARD_VIEW_BOX, viewport });
    const fitOfFlatTop = fitViewBoxToViewport({
      viewBox: {
        ...BOARD_VIEW_BOX,
        maxX: 12,
        maxY: 0,
        maxZ: 8,
        minX: -12,
        minY: 0,
        minZ: -8,
      },
      viewport,
    });
    const flatTopExtents = projectViewBox(BOARD_VIEW_BOX, viewport, fitOfFlatTop);

    expect(fitWithThickness.zoom).toBeLessThan(fitOfFlatTop.zoom);
    expect(Math.max(flatTopExtents.maxX, -flatTopExtents.minX, flatTopExtents.maxY, -flatTopExtents.minY)).toBeGreaterThan(USABLE_SHARE);
  });

  it.each([0, 1, 2, 3, -1, 7])('fits the same way after %s quarter turns of the azimuth', (turn) => {
    const viewport = { height: 640, width: 1100 };
    const azimuth = ISOMETRIC_AZIMUTH_RADIANS + turn * QUARTER_TURN_RADIANS;

    VIEW_BOXES.forEach((viewBox) => {
      const fit = fitViewBoxToViewport({ viewBox, viewport });
      const baseline = projectViewBox(viewBox, viewport, fit);
      const turned = projectViewBox(viewBox, viewport, fit, azimuth);

      expect(turned.maxX).toBeCloseTo(baseline.maxX, PRECISION);
      expect(turned.minX).toBeCloseTo(baseline.minX, PRECISION);
      expect(turned.maxY).toBeCloseTo(baseline.maxY, PRECISION);
      expect(turned.minY).toBeCloseTo(baseline.minY, PRECISION);
    });
  });

  it('zooms in proportionally to the viewport size', () => {
    const small = fitViewBoxToViewport({ viewBox: BOARD_VIEW_BOX, viewport: { height: 300, width: 500 } });
    const large = fitViewBoxToViewport({ viewBox: BOARD_VIEW_BOX, viewport: { height: 600, width: 1000 } });

    expect(large.zoom).toBeCloseTo(small.zoom * 2, PRECISION);
  });

  it('leaves a bigger margin when asked and clamps absurd margins', () => {
    const viewport = { height: 600, width: 1000 };
    const defaultFit = fitViewBoxToViewport({ viewBox: BOARD_VIEW_BOX, viewport });
    const roomyFit = fitViewBoxToViewport({ marginRatio: 0.2, viewBox: BOARD_VIEW_BOX, viewport });
    const absurdFit = fitViewBoxToViewport({ marginRatio: 5, viewBox: BOARD_VIEW_BOX, viewport });

    expect(roomyFit.zoom).toBeLessThan(defaultFit.zoom);
    expect(absurdFit.zoom).toBeGreaterThan(0);
  });

  it('stays finite and positive for a degenerate box and an empty viewport', () => {
    const degenerate = fitViewBoxToViewport({
      viewBox: {
        maxX: 3,
        maxY: 0,
        maxZ: 3,
        minX: 3,
        minY: 0,
        minZ: 3,
      },
      viewport: { height: 0, width: 0 },
    });

    expect(Number.isFinite(degenerate.zoom)).toBe(true);
    expect(degenerate.zoom).toBeGreaterThan(0);
  });
});

describe('getCameraClipping', () => {
  it('puts the whole box between the near and far planes from the viewing distance', () => {
    const clipping = getCameraClipping(OFF_CENTER_TALL_VIEW_BOX);
    const diagonal = Math.hypot(30, 7, 16);

    expect(clipping.near).toBeLessThan(clipping.distance);
    expect(clipping.far).toBeGreaterThan(clipping.distance + diagonal / 2);
  });

  it('keeps a minimum viewing distance for tiny boxes', () => {
    const clipping = getCameraClipping({
      maxX: 0.5,
      maxY: 0.5,
      maxZ: 0.5,
      minX: 0,
      minY: 0,
      minZ: 0,
    });

    expect(clipping.distance).toBeGreaterThanOrEqual(10);
  });
});
