import { CameraControlsImpl } from '@react-three/drei';
import { OrthographicCamera } from 'three';

import type { SceneInsetsValue } from '@/shared/lib/viewport';

import type { SceneBoundsValue } from '../world/sceneBounds';
import type { SceneWorldValue } from '../world/sceneWorld';
import type { PanRegionOptionsValue } from './cameraWorld';

import { ISOMETRIC_ELEVATION_RADIANS } from './cameraConstants';
import {
  isAngleSettled,
  isPointSettled,
  isZoomSettled,
  limitFrameDelta,
  shiftPointToGround,
} from './cameraSettling';
import {
  getFocusShift,
  getPanRegion,
  getViewFootprintPx,
  getZoomLimits,
} from './cameraWorld';

const FOLLOW_EPSILON_METERS = 1e-4;
const KEEP_INSIDE_EPSILON_METERS = 1e-9;
const GROUND_FORWARD_DRAG_FACTOR = 1 / Math.sin(ISOMETRIC_ELEVATION_RADIANS);

export interface WorldLimitsValue {
  insets: SceneInsetsValue;
  world: SceneWorldValue;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export class FrameLimitedCameraControls extends CameraControlsImpl {
  get zoomEnd(): number {
    return this._zoomEnd;
  }

  private footprintPx = 0;

  private groundHeight: number | undefined;

  private readonly panRegion: SceneBoundsValue = { maxX: 0, maxZ: 0, minX: 0, minZ: 0 };

  private regionOptions: PanRegionOptionsValue | undefined;

  private worldLimits: undefined | WorldLimitsValue;

  constructor(...args: ConstructorParameters<typeof CameraControlsImpl>) {
    super(...args);

    this._truckInternal = (deltaX, deltaY): void => {
      const camera = this._camera;

      if (!(camera instanceof OrthographicCamera)) {
        return;
      }

      const worldPerPixel = (camera.right - camera.left) / camera.zoom / this._elementRect.width;

      void this.truck(deltaX * worldPerPixel, 0, true);
      void this.forward(-deltaY * worldPerPixel * GROUND_FORWARD_DRAG_FACTOR, true);
    };
  }

  followPoint(x: number, y: number, z: number): void {
    const end = this._targetEnd;
    const isMoved = Math.hypot(x - end.x, y - end.y, z - end.z) > FOLLOW_EPSILON_METERS;

    if (!isMoved) {
      return;
    }

    this._isUserControllingTruck = false;
    this._boundary.clampPoint(end.set(x, y, z), end);
    this._needsUpdate = true;
  }

  setGroundHeight(height: number): void {
    this.groundHeight = height;
  }

  setWorldLimits(limits: WorldLimitsValue): void {
    this.worldLimits = limits;
    this.regionOptions = { radius: 0, world: limits.world };
    this.applyFrameGeometry();
    this.clampZoomToLimits();
    this.refreshBoundary();
    this._needsUpdate = true;
  }

  override update(delta: number): boolean {
    if (this.isFrameGeometryStale()) {
      this.applyFrameGeometry();
      this.clampZoomToLimits();
      this.refreshBoundary();
    }

    this.settleNearEnd();
    this.keepTargetOnGround();

    const isUpdated = super.update(limitFrameDelta(delta));
    const isShifted = this.keepViewInsideWorld();

    if (isShifted && !isUpdated) {
      this.dispatchEvent({ type: 'update' });
    }

    return isUpdated || isShifted;
  }

  override zoomTo(zoom: number, enableTransition = false): Promise<void> {
    const settled = super.zoomTo(zoom, enableTransition);

    this.refreshBoundary();

    return settled;
  }

  private applyFrameGeometry(): void {
    const limits = this.worldLimits;
    const camera = this._camera;

    if (limits === undefined || !(camera instanceof OrthographicCamera)) {
      return;
    }

    const width = camera.right - camera.left;
    const height = camera.top - camera.bottom;

    if (!(width > 0 && height > 0)) {
      return;
    }

    const frame = { insets: limits.insets, viewport: { height, width } };
    const shift = getFocusShift(frame);
    const zoomLimits = getZoomLimits({ ...frame, world: limits.world });

    this.footprintPx = getViewFootprintPx(frame);
    this.minZoom = zoomLimits.min;
    this.maxZoom = zoomLimits.max;
    camera.setViewOffset(width, height, -shift.x, -shift.y, width, height);
  }

  private clampZoomToLimits(): void {
    this._zoomEnd = clamp(this._zoomEnd, this.minZoom, this.maxZoom);
    this._zoom = clamp(this._zoom, this.minZoom, this.maxZoom);
  }

  private isFrameGeometryStale(): boolean {
    const camera = this._camera;

    if (this.worldLimits === undefined || !(camera instanceof OrthographicCamera)) {
      return false;
    }

    const { view } = camera;

    return view?.fullWidth !== camera.right - camera.left || view.fullHeight !== camera.top - camera.bottom;
  }

  private keepTargetOnGround(): void {
    if (this.groundHeight === undefined) {
      return;
    }

    shiftPointToGround(this._target, this._spherical, this.groundHeight);
    shiftPointToGround(this._targetEnd, this._sphericalEnd, this.groundHeight);
  }

  private keepViewInsideWorld(): boolean {
    const options = this.regionOptions;

    if (options === undefined || this.footprintPx === 0) {
      return false;
    }

    this.refreshBoundary();

    options.radius = this.footprintPx / this._zoom;

    const region = getPanRegion(options, this.panRegion);
    const target = this._target;
    const shiftX = clamp(target.x, region.minX, region.maxX) - target.x;
    const shiftZ = clamp(target.z, region.minZ, region.maxZ) - target.z;

    if (Math.abs(shiftX) + Math.abs(shiftZ) <= KEEP_INSIDE_EPSILON_METERS) {
      return false;
    }

    target.x += shiftX;
    target.z += shiftZ;
    this._camera.position.x += shiftX;
    this._camera.position.z += shiftZ;
    this._needsUpdate = true;

    return true;
  }

  private refreshBoundary(): void {
    const options = this.regionOptions;

    if (options === undefined || this.footprintPx === 0) {
      return;
    }

    options.radius = this.footprintPx / this._zoomEnd;

    const region = getPanRegion(options, this.panRegion);

    this._boundary.min.set(region.minX, -Infinity, region.minZ);
    this._boundary.max.set(region.maxX, Infinity, region.maxZ);
    this._boundary.clampPoint(this._targetEnd, this._targetEnd);
  }

  private settleNearEnd(): void {
    if (isAngleSettled(this._spherical.theta, this._sphericalEnd.theta)) {
      this._spherical.theta = this._sphericalEnd.theta;
      this._thetaVelocity.value = 0;
    }

    if (isAngleSettled(this._spherical.phi, this._sphericalEnd.phi)) {
      this._spherical.phi = this._sphericalEnd.phi;
      this._phiVelocity.value = 0;
    }

    if (isPointSettled(this._target, this._targetEnd)) {
      this._target.copy(this._targetEnd);
      this._targetVelocity.set(0, 0, 0);
    }

    if (isZoomSettled(this._zoom, this._zoomEnd)) {
      this._zoom = this._zoomEnd;
      this._zoomVelocity.value = 0;
    }
  }
}
