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

import type { PanLimitsValue } from './FrameLimitedCameraControls';

import {
  ISOMETRIC_AZIMUTH_RADIANS,
  ISOMETRIC_ELEVATION_RADIANS,
  ISOMETRIC_POLAR_RADIANS,
  QUARTER_TURN_RADIANS,
} from './cameraConstants';
import { getPanScale } from './cameraSettling';
import { FrameLimitedCameraControls } from './FrameLimitedCameraControls';

const FRAME_DELTA_S = 1 / 60;
const SETTLE_FRAMES = 240;
const ELEMENT_WIDTH_PX = 800;
const ELEMENT_HEIGHT_PX = 600;
const CAMERA_VIEW_WIDTH_M = 40;
const DRAG_PX = 100;
const WORLD_PER_PIXEL = CAMERA_VIEW_WIDTH_M / ELEMENT_WIDTH_PX;

const PAN_LIMITS: PanLimitsValue = {
  bounds: { maxX: 10, maxZ: 6, minX: -10, minZ: -6 },
  fitZoom: 1,
};

class ProbeControls extends FrameLimitedCameraControls {
  drag(deltaX: number, deltaY: number): void {
    this._elementRect = new DOMRect(0, 0, ELEMENT_WIDTH_PX, ELEMENT_HEIGHT_PX);
    this._truckInternal(deltaX, deltaY, false, true);
  }
}

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

  beforeAll(() => {
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
  });

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

  it('keeps the target inside the board scaled by the zoom above the fit', () => {
    const target = new Vector3();

    controls.setPanLimits(PAN_LIMITS);
    void controls.zoomTo(PAN_LIMITS.fitZoom, false);
    void controls.moveTo(50, 0, 50, false);
    controls.getTarget(target, true);

    expect(target.x).toBeCloseTo(0);
    expect(target.z).toBeCloseTo(0);

    const zoom = PAN_LIMITS.fitZoom * 2;
    const scale = getPanScale(zoom, PAN_LIMITS.fitZoom);

    void controls.zoomTo(zoom, false);
    void controls.moveTo(50, 0, 50, false);
    controls.getTarget(target, true);

    expect(scale).toBeCloseTo(0.5);
    expect(target.x).toBeCloseTo(10 * scale);
    expect(target.z).toBeCloseTo(6 * scale);

    void controls.moveTo(-50, 0, -50, false);
    controls.getTarget(target, true);

    expect(target.x).toBeCloseTo(-10 * scale);
    expect(target.z).toBeCloseTo(-6 * scale);
  });

  it('clamps a followed point that lies outside the pan frame', () => {
    const target = new Vector3();

    controls.setPanLimits(PAN_LIMITS);
    void controls.zoomTo(PAN_LIMITS.fitZoom * 2, false);
    controls.followPoint(100, 0, 100);
    controls.getTarget(target, true);

    expect(target.x).toBeCloseTo(5);
    expect(target.z).toBeCloseTo(3);
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
