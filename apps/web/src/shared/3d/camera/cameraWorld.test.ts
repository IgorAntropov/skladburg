import { Vector3 } from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { SceneWorldValue } from '../world/sceneWorld';
import type { PixelPointValue } from './testing/cameraFrameProbe';

import { createSquareWorld } from '../world/sceneWorld';
import {
  DEFAULT_HOME_RADIUS_METERS,
  GROUND_HEIGHT_METERS,
  WORLD_EDGE_MARGIN_METERS,
  WORLD_SIZE_METERS,
} from '../world/worldConstants';
import {
  HOME_MARGIN_RATIO,
  ISOMETRIC_AZIMUTH_RADIANS,
  ISOMETRIC_ELEVATION_RADIANS,
  MAX_ZOOM_PX_PER_METER,
  PAN_MIN_HALF_METERS,
} from './cameraConstants';
import {
  getFocusShift,
  getHomeView,
  getPanRegion,
  getViewFootprintRadius,
  getWorldClipping,
  getZoomLimits,
} from './cameraWorld';
import {
  createFrameCamera,
  FRAME_CASES,
  getWorstOverflow,
  intersectGround,
  NDC_CORNERS,
  placeFrameCamera,
  toPixels,
} from './testing/cameraFrameProbe';

const WORLD: SceneWorldValue = createSquareWorld(WORLD_SIZE_METERS);
const OVERFLOW_TOLERANCE_METERS = 1e-6;
const PIXEL_TOLERANCE = 1e-6;
const AZIMUTH_STEPS = 36;
const FULL_TURN_RADIANS = Math.PI * 2;
const HOME_RING_POINTS = 72;

const AZIMUTHS: readonly number[] = [
  ...Array.from({ length: AZIMUTH_STEPS }, (_, index) => index * FULL_TURN_RADIANS / AZIMUTH_STEPS + 0.0137),
  ISOMETRIC_AZIMUTH_RADIANS,
  ISOMETRIC_AZIMUTH_RADIANS + Math.PI / 2,
  ISOMETRIC_AZIMUTH_RADIANS + Math.PI,
  ISOMETRIC_AZIMUTH_RADIANS + Math.PI * 1.5,
];

const getZoomSamples = (min: number, max: number): number[] => {
  return [min, min * 1.1, Math.sqrt(min * max), max / 1.3, max];
};

const getTargetSamples = (region: { maxX: number; maxZ: number; minX: number; minZ: number }): Vector3[] => {
  const centerX = (region.minX + region.maxX) / 2;
  const centerZ = (region.minZ + region.maxZ) / 2;
  const xs = [region.minX, centerX, region.maxX];
  const zs = [region.minZ, centerZ, region.maxZ];

  return xs.flatMap(x => zs.map(z => new Vector3(x, GROUND_HEIGHT_METERS, z)));
};

describe('getPanRegion', () => {
  it('shrinks the world by the radius and the edge margin on every side', () => {
    const region = getPanRegion({ radius: 30, world: WORLD });
    const inset = 30 + WORLD_EDGE_MARGIN_METERS;

    expect(region).toEqual({
      maxX: WORLD_SIZE_METERS / 2 - inset,
      maxZ: WORLD_SIZE_METERS / 2 - inset,
      minX: -WORLD_SIZE_METERS / 2 + inset,
      minZ: -WORLD_SIZE_METERS / 2 + inset,
    });
  });

  it('collapses to the world center when the radius leaves no room', () => {
    expect(getPanRegion({ radius: 500, world: WORLD })).toEqual({ maxX: 0, maxZ: 0, minX: 0, minZ: 0 });
  });

  it('writes into the given object without allocating a new one', () => {
    const out = { maxX: 0, maxZ: 0, minX: 0, minZ: 0 };

    expect(getPanRegion({ radius: 10, world: WORLD }, out)).toBe(out);
    expect(out.maxX).toBeCloseTo(WORLD_SIZE_METERS / 2 - 10 - WORLD_EDGE_MARGIN_METERS, 9);
  });
});

describe('getFocusShift', () => {
  it('is zero for equal insets and points to the free area otherwise', () => {
    const viewport = { height: 800, width: 1200 };

    expect(getFocusShift({ insets: { bottom: 0, left: 0, right: 0, top: 0 }, viewport })).toEqual({ x: 0, y: 0 });
    expect(getFocusShift({ insets: { bottom: 50, left: 300, right: 100, top: 10 }, viewport })).toEqual({ x: 100, y: -20 });
  });
});

describe.each(FRAME_CASES)('world camera math on $name', ({ insets, viewport }) => {
  const limits = getZoomLimits({ insets, viewport, world: WORLD });
  const camera = createFrameCamera(viewport);
  const corner = new Vector3();
  const pixel: PixelPointValue = { x: 0, y: 0 };

  it('keeps the pan region at least as wide as the minimum at the minimum zoom, and the zoom range ordered', () => {
    const region = getPanRegion({ radius: getViewFootprintRadius({ insets, viewport, zoom: limits.min }), world: WORLD });

    expect(limits.min).toBeGreaterThan(0);
    expect(limits.max).toBeGreaterThanOrEqual(limits.min);
    expect(limits.max).toBeGreaterThanOrEqual(MAX_ZOOM_PX_PER_METER);
    expect((region.maxX - region.minX) / 2).toBeGreaterThanOrEqual(PAN_MIN_HALF_METERS - OVERFLOW_TOLERANCE_METERS);
    expect((region.maxZ - region.minZ) / 2).toBeGreaterThanOrEqual(PAN_MIN_HALF_METERS - OVERFLOW_TOLERANCE_METERS);
  });

  it('keeps every corner of the frame on the ground inside the world at any azimuth, zoom and target', () => {
    let worstOverflow = -Infinity;

    for (const zoom of getZoomSamples(limits.min, limits.max)) {
      const radius = getViewFootprintRadius({ insets, viewport, zoom });
      const targets = getTargetSamples(getPanRegion({ radius, world: WORLD }));

      for (const azimuth of AZIMUTHS) {
        for (const target of targets) {
          placeFrameCamera({ azimuth, camera, insets, viewport, zoom }, target);
          worstOverflow = Math.max(worstOverflow, getWorstOverflow(camera, WORLD.bounds));
        }
      }
    }

    expect(worstOverflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_METERS);
  });

  it('measures the footprint radius exactly: the farthest corner is at that distance at every azimuth', () => {
    const zoom = limits.min * 1.7;
    const radius = getViewFootprintRadius({ insets, viewport, zoom });
    const target = new Vector3();

    for (const azimuth of AZIMUTHS) {
      placeFrameCamera({ azimuth, camera, insets, viewport, zoom }, target);

      const farthest = Math.max(...NDC_CORNERS.map((ndc) => {
        intersectGround(camera, ndc.x, ndc.y, corner);

        return Math.hypot(corner.x - target.x, corner.z - target.z);
      }));

      expect(farthest).toBeCloseTo(radius, 6);
    }
  });

  it('puts the target in the center of the free area at any azimuth and zoom', () => {
    const freeCenterX = (insets.left + viewport.width - insets.right) / 2;
    const freeCenterY = (insets.top + viewport.height - insets.bottom) / 2;
    const target = new Vector3(7, GROUND_HEIGHT_METERS, -11);

    for (const zoom of getZoomSamples(limits.min, limits.max)) {
      for (const azimuth of AZIMUTHS) {
        placeFrameCamera({ azimuth, camera, insets, viewport, zoom }, target);
        toPixels(camera, target, viewport, pixel);

        expect(Math.abs(pixel.x - freeCenterX)).toBeLessThan(PIXEL_TOLERANCE);
        expect(Math.abs(pixel.y - freeCenterY)).toBeLessThan(PIXEL_TOLERANCE);
      }
    }
  });

  it('gives a home zoom within the zoom range and a home frame inside the world', () => {
    const home = getHomeView({ insets, viewport, world: WORLD });

    expect(home.zoom).toBeGreaterThanOrEqual(limits.min);
    expect(home.zoom).toBeLessThanOrEqual(limits.max);
    expect(home.target.y).toBe(GROUND_HEIGHT_METERS);

    placeFrameCamera(
      { azimuth: ISOMETRIC_AZIMUTH_RADIANS, camera, insets, viewport, zoom: home.zoom },
      new Vector3(home.target.x, home.target.y, home.target.z),
    );

    expect(getWorstOverflow(camera, WORLD.bounds)).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_METERS);
  });

  it('fits the home zone into the free area with the margin, or stands at the minimum zoom when it cannot', () => {
    const home = getHomeView({ insets, viewport, world: WORLD });
    const freeLeft = insets.left;
    const freeRight = viewport.width - insets.right;
    const freeTop = insets.top;
    const freeBottom = viewport.height - insets.bottom;
    const marginX = (freeRight - freeLeft) * HOME_MARGIN_RATIO;
    const marginY = (freeBottom - freeTop) * HOME_MARGIN_RATIO;
    const isFitting = home.zoom > limits.min * (1 + 1e-9);

    placeFrameCamera(
      { azimuth: ISOMETRIC_AZIMUTH_RADIANS, camera, insets, viewport, zoom: home.zoom },
      new Vector3(home.target.x, home.target.y, home.target.z),
    );

    if (!isFitting) {
      expect(home.zoom).toBeCloseTo(limits.min, 9);

      return;
    }

    const edge = new Vector3();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let index = 0; index < HOME_RING_POINTS; index += 1) {
      const angle = index * FULL_TURN_RADIANS / HOME_RING_POINTS;

      edge.set(
        WORLD.home.centerX + Math.cos(angle) * WORLD.home.radius,
        GROUND_HEIGHT_METERS,
        WORLD.home.centerZ + Math.sin(angle) * WORLD.home.radius,
      );
      toPixels(camera, edge, viewport, pixel);
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    }

    expect(minX).toBeGreaterThanOrEqual(freeLeft + marginX - 1e-6);
    expect(maxX).toBeLessThanOrEqual(freeRight - marginX + 1e-6);
    expect(minY).toBeGreaterThanOrEqual(freeTop + marginY - 1e-6);
    expect(maxY).toBeLessThanOrEqual(freeBottom - marginY + 1e-6);
    expect(Math.min(minX - freeLeft - marginX, freeRight - marginX - maxX, minY - freeTop - marginY, freeBottom - marginY - maxY))
      .toBeLessThan(1e-6);
  });
});

describe('getHomeView', () => {
  const insets = { bottom: 56, left: 384, right: 384, top: 72 };
  const viewport = { height: 2160, width: 3840 };

  it('stands at the center of the world for the default home zone', () => {
    const home = getHomeView({ insets, viewport, world: WORLD });

    expect(home.target).toEqual({ x: 0, y: GROUND_HEIGHT_METERS, z: 0 });
    expect(WORLD.home.radius).toBe(DEFAULT_HOME_RADIUS_METERS);
    expect(home.zoom).toBeGreaterThan(getZoomLimits({ insets, viewport, world: WORLD }).min);
  });

  it('pulls the target of a home zone near the edge into the pan region of the home zoom', () => {
    const nearEdge = { centerX: WORLD_SIZE_METERS / 2 - 3, centerZ: -WORLD_SIZE_METERS / 2 + 3, radius: 20 };
    const world: SceneWorldValue = { ...WORLD, home: nearEdge };
    const home = getHomeView({ insets, viewport, world });
    const region = getPanRegion({ radius: getViewFootprintRadius({ insets, viewport, zoom: home.zoom }), world });

    expect(home.target.x).toBeCloseTo(region.maxX, 9);
    expect(home.target.z).toBeCloseTo(region.minZ, 9);
  });

  it('gives a larger home zoom to a smaller home zone', () => {
    const small = getHomeView({ insets, viewport, world: { ...WORLD, home: { ...WORLD.home, radius: 10 } } });
    const large = getHomeView({ insets, viewport, world: { ...WORLD, home: { ...WORLD.home, radius: 30 } } });

    expect(small.zoom).toBeGreaterThan(large.zoom);
  });
});

describe('getZoomLimits', () => {
  it('raises the minimum zoom when the free area shifts away from the center of the canvas', () => {
    const viewport = { height: 900, width: 1440 };
    const centered = getZoomLimits({ insets: { bottom: 0, left: 0, right: 0, top: 0 }, viewport, world: WORLD });
    const shifted = getZoomLimits({ insets: { bottom: 0, left: 600, right: 0, top: 0 }, viewport, world: WORLD });

    expect(shifted.min).toBeGreaterThan(centered.min);
  });

  it('lifts the maximum to the minimum when even the absolute maximum would show too much of the world', () => {
    const tinyWorld = createSquareWorld(WORLD_EDGE_MARGIN_METERS * 2 + PAN_MIN_HALF_METERS * 2 + 4);
    const insets = { bottom: 0, left: 0, right: 0, top: 0 };
    const limits = getZoomLimits({ insets, viewport: { height: 2160, width: 3840 }, world: tinyWorld });

    expect(limits.min).toBeGreaterThan(MAX_ZOOM_PX_PER_METER);
    expect(limits.max).toBe(limits.min);
  });

  it('gives a finite positive zoom for a canvas that has no size yet', () => {
    const insets = { bottom: 0, left: 0, right: 0, top: 0 };
    const viewport = { height: 0, width: 0 };
    const limits = getZoomLimits({ insets, viewport, world: WORLD });
    const home = getHomeView({ insets, viewport, world: WORLD });

    expect(limits.min).toBeGreaterThan(0);
    expect(Number.isFinite(limits.max)).toBe(true);
    expect(home.zoom).toBeGreaterThan(0);
    expect(Number.isFinite(home.zoom)).toBe(true);
  });
});

describe('isometric angles', () => {
  it('looks at the world from the classic isometric elevation and a diagonal azimuth', () => {
    expect((ISOMETRIC_ELEVATION_RADIANS * 180) / Math.PI).toBeCloseTo(35.264, 3);
    expect(ISOMETRIC_AZIMUTH_RADIANS).toBeCloseTo(Math.PI / 4, 10);
  });
});

describe('getWorldClipping', () => {
  it.each([
    { name: 'the default world', world: WORLD },
    { name: 'a tiny world', world: createSquareWorld(1) },
  ])('keeps the whole of $name between the near and far planes from the camera distance', ({ world }) => {
    const clipping = getWorldClipping(world);
    const diagonal = Math.hypot(
      world.bounds.maxX - world.bounds.minX,
      world.bounds.maxZ - world.bounds.minZ,
      world.maxHeight,
    );

    expect(clipping.near).toBeGreaterThan(0);
    expect(clipping.distance - diagonal / 2).toBeGreaterThan(clipping.near);
    expect(clipping.far).toBeGreaterThan(clipping.distance + diagonal / 2);
  });
});
