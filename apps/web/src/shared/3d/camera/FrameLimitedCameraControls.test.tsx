import { CameraControlsImpl } from '@react-three/drei';
import {
  Box3,
  MathUtils,
  Matrix4,
  OrthographicCamera,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
} from 'three';
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import type { SceneInsetsValue } from '@/shared/lib/viewport';

import type { SceneWorldValue } from '../world/sceneWorld';
import type {
  FrameCaseValue,
  PixelPointValue,
} from './testing/cameraFrameProbe';

import { createSquareWorld } from '../world/sceneWorld';
import {
  GROUND_HEIGHT_METERS,
  WORLD_SIZE_METERS,
} from '../world/worldConstants';
import {
  ISOMETRIC_AZIMUTH_RADIANS,
  ISOMETRIC_ELEVATION_RADIANS,
  ISOMETRIC_POLAR_RADIANS,
  PAN_MIN_HALF_METERS,
  QUARTER_TURN_RADIANS,
} from './cameraConstants';
import {
  getPanRegion,
  getViewFootprintRadius,
  getWorldClipping,
  getZoomLimits,
} from './cameraWorld';
import { FrameLimitedCameraControls } from './FrameLimitedCameraControls';
import {
  createFrameCamera,
  getWorstOverflow,
  intersectGround,
  toPixels,
} from './testing/cameraFrameProbe';

const FRAME_DELTA_S = 1 / 60;
const SETTLE_FRAMES = 240;
const ELEMENT_WIDTH_PX = 800;
const ELEMENT_HEIGHT_PX = 600;
const CAMERA_VIEW_WIDTH_M = 40;
const DRAG_PX = 100;
const WORLD_PER_PIXEL = CAMERA_VIEW_WIDTH_M / ELEMENT_WIDTH_PX;

const WORLD: SceneWorldValue = createSquareWorld(WORLD_SIZE_METERS);
const OVERFLOW_TOLERANCE_METERS = 1e-6;
const PIXEL_TOLERANCE = 1e-6;
const WORLD_FRAME_COUNT = 240;
const WHEEL_STEP = 6;
const FAST_ZOOM_SMOOTH_TIME_S = 0.03;
const SLOW_TARGET_SMOOTH_TIME_S = 0.4;
const CURSOR_TOLERANCE_METERS = 1e-6;

const DESKTOP_CASE: FrameCaseValue = {
  insets: { bottom: 56, left: 384, right: 384, top: 72 },
  name: 'desktop with columns',
  viewport: { height: 900, width: 1440 },
};

const LOPSIDED_CASE: FrameCaseValue = {
  insets: { bottom: 100, left: 0, right: 400, top: 72 },
  name: 'desktop with a column on the right',
  viewport: { height: 800, width: 1280 },
};

class ProbeControls extends FrameLimitedCameraControls {
  private elementHeight = ELEMENT_HEIGHT_PX;

  private elementWidth = ELEMENT_WIDTH_PX;

  drag(deltaX: number, deltaY: number): void {
    this._elementRect = new DOMRect(0, 0, this.elementWidth, this.elementHeight);
    this._truckInternal(deltaX, deltaY, false, true);
  }

  holdZoom(): void {
    this._isUserControllingZoom = true;
  }

  setElementSize(width: number, height: number): void {
    this.elementWidth = width;
    this.elementHeight = height;
  }

  wheel(delta: number, ndcX: number, ndcY: number): void {
    this._zoomInternal(delta, ndcX, ndcY);
  }
}

const installCameraControls = (): void => {
  CameraControlsImpl.install({
    THREE: {
      Box3,
      MathUtils: { clamp: MathUtils.clamp },
      Matrix4,
      Quaternion,
      Raycaster,
      Sphere,
      Spherical,
      Vector2,
      Vector3,
      Vector4,
    },
  });
};

const createControls = (): ProbeControls => {
  const camera = new OrthographicCamera(-20, 20, 10, -10, 0.1, 500);

  camera.position.set(50, 40, 50);
  camera.lookAt(0, 0, 0);

  const controls = new ProbeControls(camera);

  controls.minPolarAngle = ISOMETRIC_POLAR_RADIANS;
  controls.maxPolarAngle = ISOMETRIC_POLAR_RADIANS;
  void controls.rotateTo(ISOMETRIC_AZIMUTH_RADIANS, ISOMETRIC_POLAR_RADIANS, false);
  void controls.moveTo(0, 0, 0, false);

  return controls;
};

const settle = (controls: ProbeControls): void => {
  for (let frame = 0; frame < SETTLE_FRAMES; frame += 1) {
    controls.update(FRAME_DELTA_S);
  }
};

describe('FrameLimitedCameraControls', () => {
  let controls: ProbeControls;

  beforeAll(installCameraControls);

  beforeEach(() => {
    controls = createControls();
  });

  it('limits one long frame so a quarter-turn rotation is not finished in a single update', () => {
    const startAzimuth = controls.azimuthAngle;

    void controls.rotateTo(startAzimuth + QUARTER_TURN_RADIANS, ISOMETRIC_POLAR_RADIANS, true);
    controls.update(5);

    const moved = controls.azimuthAngle - startAzimuth;

    expect(moved).toBeGreaterThan(0);
    expect(moved).toBeLessThan(QUARTER_TURN_RADIANS / 4);
  });

  it('pulls a target raised above the floor back down to the ground height', () => {
    const target = new Vector3();
    const groundHeight = 0.5;

    controls.setGroundHeight(groundHeight);
    void controls.moveTo(0, 3, 0, false);
    controls.update(FRAME_DELTA_S);
    controls.getTarget(target, false);

    expect(target.y).toBeCloseTo(groundHeight);

    controls.getTarget(target, true);

    expect(target.y).toBeCloseTo(groundHeight);
  });

  it('drags along the floor by the ground distance under the cursor without changing the target height', () => {
    const before = new Vector3();
    const after = new Vector3();

    controls.getTarget(before, true);
    controls.drag(0, DRAG_PX);
    settle(controls);
    controls.getTarget(after, false);

    const verticalDragDistance = Math.hypot(after.x - before.x, after.z - before.z);

    expect(verticalDragDistance).toBeCloseTo(DRAG_PX * WORLD_PER_PIXEL / Math.sin(ISOMETRIC_ELEVATION_RADIANS), 2);
    expect(after.y).toBeCloseTo(before.y);

    controls.getTarget(before, true);
    controls.drag(DRAG_PX, 0);
    settle(controls);
    controls.getTarget(after, false);

    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeCloseTo(DRAG_PX * WORLD_PER_PIXEL, 2);
    expect(after.y).toBeCloseTo(before.y);
  });
});

interface WorldRigValue {
  camera: OrthographicCamera;
  controls: ProbeControls;
  frameCase: FrameCaseValue;
}

const createWorldRig = (frameCase: FrameCaseValue): WorldRigValue => {
  const { insets, viewport } = frameCase;
  const clipping = getWorldClipping(WORLD);
  const camera = createFrameCamera(viewport);

  camera.near = clipping.near;
  camera.far = clipping.far;
  camera.updateProjectionMatrix();

  const controls = new ProbeControls(camera);

  controls.dollyToCursor = true;
  controls.minPolarAngle = ISOMETRIC_POLAR_RADIANS;
  controls.maxPolarAngle = ISOMETRIC_POLAR_RADIANS;
  controls.setElementSize(viewport.width, viewport.height);
  controls.setGroundHeight(GROUND_HEIGHT_METERS);
  controls.setWorldLimits({ insets, world: WORLD });
  void controls.dollyTo(clipping.distance, false);
  void controls.rotateTo(ISOMETRIC_AZIMUTH_RADIANS, ISOMETRIC_POLAR_RADIANS, false);
  void controls.moveTo(0, GROUND_HEIGHT_METERS, 0, false);
  controls.update(FRAME_DELTA_S);
  camera.updateMatrixWorld();

  return { camera, controls, frameCase };
};

const stepFrame = ({ camera, controls }: WorldRigValue): number => {
  controls.update(FRAME_DELTA_S);
  camera.updateMatrixWorld();

  return getWorstOverflow(camera, WORLD.bounds);
};

const runFrames = (rig: WorldRigValue, frames: number, beforeFrame?: (frame: number) => void): number => {
  let worstOverflow = -Infinity;

  for (let frame = 0; frame < frames; frame += 1) {
    beforeFrame?.(frame);
    worstOverflow = Math.max(worstOverflow, stepFrame(rig));
  }

  return worstOverflow;
};

const getRegionAtZoom = ({ frameCase }: WorldRigValue, zoom: number): ReturnType<typeof getPanRegion> => {
  const { insets, viewport } = frameCase;

  return getPanRegion({ radius: getViewFootprintRadius({ insets, viewport, zoom }), world: WORLD });
};

const getFreeCenter = (insets: SceneInsetsValue, width: number, height: number): PixelPointValue => ({
  x: (insets.left + width - insets.right) / 2,
  y: (insets.top + height - insets.bottom) / 2,
});

describe.each([DESKTOP_CASE, LOPSIDED_CASE])('FrameLimitedCameraControls in the world, $name', (frameCase) => {
  const { insets, viewport } = frameCase;
  const zoomLimits = getZoomLimits({ insets, viewport, world: WORLD });
  const pixel: PixelPointValue = { x: 0, y: 0 };

  let rig: WorldRigValue;

  beforeAll(installCameraControls);

  beforeEach(() => {
    rig = createWorldRig(frameCase);
  });

  it('applies the zoom range of the world to the controls', () => {
    expect(rig.controls.minZoom).toBeCloseTo(zoomLimits.min, 9);
    expect(rig.controls.maxZoom).toBeCloseTo(zoomLimits.max, 9);
  });

  it('stands the target in the center of the free area', () => {
    const target = new Vector3(12, GROUND_HEIGHT_METERS, -9);

    void rig.controls.zoomTo(zoomLimits.min * 2, false);
    void rig.controls.moveTo(target.x, target.y, target.z, false);
    stepFrame(rig);
    toPixels(rig.camera, target, viewport, pixel);

    const center = getFreeCenter(insets, viewport.width, viewport.height);

    expect(Math.abs(pixel.x - center.x)).toBeLessThan(PIXEL_TOLERANCE);
    expect(Math.abs(pixel.y - center.y)).toBeLessThan(PIXEL_TOLERANCE);
  });

  it('clamps the target to the pan region of the final zoom', () => {
    const target = new Vector3();

    for (const zoom of [zoomLimits.min, zoomLimits.min * 2, zoomLimits.max]) {
      const region = getRegionAtZoom(rig, zoom);

      void rig.controls.zoomTo(zoom, false);
      void rig.controls.moveTo(1000, 0, 1000, false);
      rig.controls.getTarget(target, true);

      expect(target.x).toBeCloseTo(region.maxX, 9);
      expect(target.z).toBeCloseTo(region.maxZ, 9);

      void rig.controls.moveTo(-1000, 0, -1000, false);
      rig.controls.getTarget(target, true);

      expect(target.x).toBeCloseTo(region.minX, 9);
      expect(target.z).toBeCloseTo(region.minZ, 9);
    }
  });

  it('keeps panning possible at the minimum zoom', () => {
    const target = new Vector3();

    void rig.controls.zoomTo(zoomLimits.min, false);
    void rig.controls.moveTo(1000, 0, 1000, false);
    rig.controls.getTarget(target, true);

    expect(target.x).toBeGreaterThanOrEqual(PAN_MIN_HALF_METERS - 1e-6);
    expect(target.z).toBeGreaterThanOrEqual(PAN_MIN_HALF_METERS - 1e-6);
  });

  it('clamps a followed point that lies outside the pan region', () => {
    const target = new Vector3();
    const zoom = zoomLimits.min * 2;
    const region = getRegionAtZoom(rig, zoom);

    void rig.controls.zoomTo(zoom, false);
    rig.controls.followPoint(1000, 0, -1000);
    rig.controls.getTarget(target, true);

    expect(target.x).toBeCloseTo(region.maxX, 9);
    expect(target.z).toBeCloseTo(region.minZ, 9);
  });

  it('keeps the frame inside the world in every frame of an animated zoom-out from a corner', () => {
    const target = new Vector3();
    const startTarget = new Vector3();

    void rig.controls.zoomTo(zoomLimits.max, false);
    void rig.controls.moveTo(1000, 0, 1000, false);
    stepFrame(rig);
    rig.controls.getTarget(startTarget, false);
    void rig.controls.zoomTo(zoomLimits.min, true);

    const worstOverflow = runFrames(rig, WORLD_FRAME_COUNT);

    rig.controls.getTarget(target, false);

    expect(worstOverflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_METERS);
    expect(rig.controls.zoomEnd).toBeCloseTo(zoomLimits.min, 9);
    expect(target.x).toBeLessThan(startTarget.x);
    expect(target.x).toBeLessThanOrEqual(getRegionAtZoom(rig, zoomLimits.min).maxX + 1e-6);
  });

  it('keeps the frame inside the world in every frame when the zoom settles faster than the target', () => {
    rig.controls.draggingSmoothTime = FAST_ZOOM_SMOOTH_TIME_S;
    rig.controls.smoothTime = SLOW_TARGET_SMOOTH_TIME_S;
    void rig.controls.zoomTo(zoomLimits.max, false);
    void rig.controls.moveTo(1000, 0, -1000, false);
    stepFrame(rig);
    rig.controls.holdZoom();
    void rig.controls.zoomTo(zoomLimits.min, true);
    rig.controls.holdZoom();

    expect(runFrames(rig, WORLD_FRAME_COUNT)).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_METERS);
  });

  it('keeps the frame inside the world in every frame while rotating during the zoom-out', () => {
    void rig.controls.zoomTo(zoomLimits.max, false);
    void rig.controls.moveTo(-1000, 0, 1000, false);
    stepFrame(rig);
    void rig.controls.zoomTo(zoomLimits.min, true);

    const worstOverflow = runFrames(rig, WORLD_FRAME_COUNT, (frame) => {
      if (frame === 3) {
        void rig.controls.rotateTo(ISOMETRIC_AZIMUTH_RADIANS + QUARTER_TURN_RADIANS, ISOMETRIC_POLAR_RADIANS, true);
      }

      if (frame === 17) {
        void rig.controls.rotateTo(ISOMETRIC_AZIMUTH_RADIANS + QUARTER_TURN_RADIANS * 2, ISOMETRIC_POLAR_RADIANS, true);
      }
    });

    expect(worstOverflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_METERS);
  });

  it('keeps the frame inside the world in every frame while dragging against each edge', () => {
    const target = new Vector3();
    const zoom = zoomLimits.min * 1.6;
    const region = getRegionAtZoom(rig, zoom);
    const reached = { maxX: -Infinity, maxZ: -Infinity, minX: Infinity, minZ: Infinity };
    const directions = [[400, 400], [-400, -400], [400, -400], [-400, 400]] as const;
    let worstOverflow = -Infinity;

    void rig.controls.zoomTo(zoom, false);

    for (const [deltaX, deltaY] of directions) {
      worstOverflow = Math.max(worstOverflow, runFrames(rig, 90, () => {
        rig.controls.drag(deltaX, deltaY);
      }));
      rig.controls.getTarget(target, true);
      reached.minX = Math.min(reached.minX, target.x);
      reached.maxX = Math.max(reached.maxX, target.x);
      reached.minZ = Math.min(reached.minZ, target.z);
      reached.maxZ = Math.max(reached.maxZ, target.z);
    }

    expect(worstOverflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_METERS);
    expect(reached.maxX).toBeCloseTo(region.maxX, 3);
    expect(reached.minX).toBeCloseTo(region.minX, 3);
    expect(reached.maxZ).toBeCloseTo(region.maxZ, 3);
    expect(reached.minZ).toBeCloseTo(region.minZ, 3);
  });

  it('keeps the frame inside the world in every frame of the wheel zoom to a cursor at the edge', () => {
    const corners = [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const;

    for (const [ndcX, ndcY] of corners) {
      void rig.controls.zoomTo(zoomLimits.min * 1.5, false);
      void rig.controls.moveTo(ndcX * 1000, 0, -ndcY * 1000, false);
      stepFrame(rig);

      let worstOverflow = runFrames(rig, 40, (frame) => {
        if (frame % 8 === 0) {
          rig.controls.wheel(-WHEEL_STEP, ndcX, ndcY);
        }
      });

      worstOverflow = Math.max(worstOverflow, runFrames(rig, 120, (frame) => {
        if (frame % 5 === 0) {
          rig.controls.wheel(WHEEL_STEP, ndcX, ndcY);
        }
      }));

      expect(worstOverflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_METERS);
    }
  });

  it('keeps the world point under the cursor in place when the wheel zooms with a shifted projection center', () => {
    const before = new Vector3();
    const after = new Vector3();
    const cursors = [[0.4, -0.3], [-0.5, 0.2], [0.1, 0.6]] as const;

    for (const [ndcX, ndcY] of cursors) {
      void rig.controls.zoomTo(zoomLimits.min * 3, false);
      void rig.controls.moveTo(5, 0, -4, false);
      stepFrame(rig);
      intersectGround(rig.camera, ndcX, ndcY, before);

      rig.controls.wheel(-WHEEL_STEP, ndcX, ndcY);
      runFrames(rig, 90);
      intersectGround(rig.camera, ndcX, ndcY, after);

      expect(rig.controls.zoomEnd).toBeGreaterThan(zoomLimits.min * 3);
      expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(CURSOR_TOLERANCE_METERS);
    }
  });

  it('drags the ground by the pixel distance divided by the zoom with a shifted projection center', () => {
    const before = new Vector3();
    const after = new Vector3();
    const zoom = zoomLimits.min * 2;

    void rig.controls.zoomTo(zoom, false);
    void rig.controls.moveTo(0, 0, 0, false);
    stepFrame(rig);
    rig.controls.getTarget(before, true);
    rig.controls.drag(100, 0);
    runFrames(rig, 90);
    rig.controls.getTarget(after, false);

    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeCloseTo(100 / zoom, 6);

    rig.controls.getTarget(before, true);
    rig.controls.drag(0, 100);
    runFrames(rig, 90);
    rig.controls.getTarget(after, false);

    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeCloseTo(100 / zoom / Math.sin(ISOMETRIC_ELEVATION_RADIANS), 6);
  });

  it('keeps the target at the border after the ground height shifts it along the line of sight', () => {
    const target = new Vector3();
    const zoom = zoomLimits.min * 2;
    const region = getRegionAtZoom(rig, zoom);

    void rig.controls.zoomTo(zoom, false);
    void rig.controls.moveTo(-1000, 4, -1000, false);
    stepFrame(rig);

    for (const isEnd of [false, true]) {
      rig.controls.getTarget(target, isEnd);

      expect(target.y).toBeCloseTo(GROUND_HEIGHT_METERS, 9);
      expect(target.x).toBeGreaterThanOrEqual(region.minX - 1e-9);
      expect(target.z).toBeGreaterThanOrEqual(region.minZ - 1e-9);
    }

    rig.controls.getTarget(target, true);
    void rig.controls.moveTo(target.x, target.y + 3, target.z, false);
    stepFrame(rig);
    rig.controls.getTarget(target, false);

    expect(target.y).toBeCloseTo(GROUND_HEIGHT_METERS, 9);
    expect(target.x).toBeGreaterThanOrEqual(region.minX - 1e-9);
    expect(target.z).toBeGreaterThanOrEqual(region.minZ - 1e-9);
  });

  it('re-centers the target in the free area and refreshes the limits after the canvas is resized', () => {
    const target = new Vector3();
    const resized = { height: viewport.height + 240, width: viewport.width + 480 };
    const resizedLimits = getZoomLimits({ insets, viewport: resized, world: WORLD });

    void rig.controls.zoomTo(zoomLimits.min * 2, false);
    void rig.controls.moveTo(14, 0, 3, false);
    stepFrame(rig);

    rig.camera.left = -resized.width / 2;
    rig.camera.right = resized.width / 2;
    rig.camera.top = resized.height / 2;
    rig.camera.bottom = -resized.height / 2;
    rig.camera.updateProjectionMatrix();

    const worstOverflow = runFrames(rig, 3);

    rig.controls.getTarget(target, false);
    toPixels(rig.camera, target, resized, pixel);

    const center = getFreeCenter(insets, resized.width, resized.height);

    expect(worstOverflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_METERS);
    expect(rig.controls.minZoom).toBeCloseTo(resizedLimits.min, 9);
    expect(Math.abs(pixel.x - center.x)).toBeLessThan(PIXEL_TOLERANCE);
    expect(Math.abs(pixel.y - center.y)).toBeLessThan(PIXEL_TOLERANCE);
  });

  it('re-centers the target when the free area changes', () => {
    const target = new Vector3(14, GROUND_HEIGHT_METERS, 3);
    const nextInsets: SceneInsetsValue = { bottom: 10, left: 120, right: 20, top: 200 };

    void rig.controls.zoomTo(zoomLimits.min * 2, false);
    void rig.controls.moveTo(target.x, target.y, target.z, false);
    stepFrame(rig);

    rig.controls.setWorldLimits({ insets: nextInsets, world: WORLD });
    const worstOverflow = runFrames(rig, 3);

    toPixels(rig.camera, target, viewport, pixel);

    const center = getFreeCenter(nextInsets, viewport.width, viewport.height);

    expect(worstOverflow).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_METERS);
    expect(Math.abs(pixel.x - center.x)).toBeLessThan(PIXEL_TOLERANCE);
    expect(Math.abs(pixel.y - center.y)).toBeLessThan(PIXEL_TOLERANCE);
  });
});
