import { CameraControlsImpl } from '@react-three/drei';
import { OrthographicCamera } from 'three';

import type { SceneBoundsValue } from '../world/sceneBounds';

import { ISOMETRIC_ELEVATION_RADIANS } from './cameraConstants';
import {
  getPanScale,
  isAngleSettled,
  isPointSettled,
  isZoomSettled,
  limitFrameDelta,
  shiftPointToGround,
} from './cameraSettling';

const FOLLOW_EPSILON_METERS = 1e-4;
const GROUND_FORWARD_DRAG_FACTOR = 1 / Math.sin(ISOMETRIC_ELEVATION_RADIANS);

export interface PanLimitsValue {
  bounds: SceneBoundsValue;
  fitZoom: number;
}

export class FrameLimitedCameraControls extends CameraControlsImpl {
  get zoomEnd(): number {
    return this._zoomEnd;
  }

  private groundHeight: number | undefined;

  private panLimits: PanLimitsValue | undefined;

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

  setPanLimits(limits: PanLimitsValue): void {
    this.panLimits = limits;
    this.refreshBoundary();
    this._needsUpdate = true;
  }

  override update(delta: number): boolean {
    this.settleNearEnd();
    this.keepTargetOnGround();

    return super.update(limitFrameDelta(delta));
  }

  override zoomTo(zoom: number, enableTransition = false): Promise<void> {
    const settled = super.zoomTo(zoom, enableTransition);

    this.refreshBoundary();

    return settled;
  }

  private keepTargetOnGround(): void {
    if (this.groundHeight === undefined) {
      return;
    }

    shiftPointToGround(this._target, this._spherical, this.groundHeight);
    shiftPointToGround(this._targetEnd, this._sphericalEnd, this.groundHeight);
  }

  private refreshBoundary(): void {
    const limits = this.panLimits;

    if (limits === undefined) {
      return;
    }

    const { bounds } = limits;
    const scale = getPanScale(this._zoomEnd, limits.fitZoom);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const halfX = ((bounds.maxX - bounds.minX) / 2) * scale;
    const halfZ = ((bounds.maxZ - bounds.minZ) / 2) * scale;

    this._boundary.min.set(centerX - halfX, -Infinity, centerZ - halfZ);
    this._boundary.max.set(centerX + halfX, Infinity, centerZ + halfZ);
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
