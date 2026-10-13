import type { SceneViewBoxValue } from '../world/sceneBounds';
import type {
  CameraFitValue,
  ViewportSizeValue,
} from './cameraTypes';

import {
  DEFAULT_FIT_MARGIN_RATIO,
  ISOMETRIC_AZIMUTH_RADIANS,
  ISOMETRIC_ELEVATION_RADIANS,
} from './cameraConstants';

const MAX_FIT_MARGIN_RATIO = 0.45;
const MIN_HALF_EXTENT_METERS = 0.5;
const MIN_ZOOM = 0.001;
const MIN_CAMERA_DISTANCE_METERS = 10;
const CAMERA_DISTANCE_DIAGONALS = 2;
const FAR_PADDING_METERS = 20;
const NEAR_PLANE_METERS = 0.1;

export interface CameraClippingValue {
  distance: number;
  far: number;
  near: number;
}

export interface FitViewBoxOptionsValue {
  marginRatio?: number | undefined;
  viewBox: SceneViewBoxValue;
  viewport: ViewportSizeValue;
}

export const fitViewBoxToViewport = ({
  marginRatio = DEFAULT_FIT_MARGIN_RATIO,
  viewBox,
  viewport,
}: FitViewBoxOptionsValue): CameraFitValue => {
  const absSinAzimuth = Math.abs(Math.sin(ISOMETRIC_AZIMUTH_RADIANS));
  const absCosAzimuth = Math.abs(Math.cos(ISOMETRIC_AZIMUTH_RADIANS));
  const sinElevation = Math.sin(ISOMETRIC_ELEVATION_RADIANS);
  const cosElevation = Math.cos(ISOMETRIC_ELEVATION_RADIANS);

  const halfX = (viewBox.maxX - viewBox.minX) / 2;
  const halfY = (viewBox.maxY - viewBox.minY) / 2;
  const halfZ = (viewBox.maxZ - viewBox.minZ) / 2;

  const halfScreenWidth = Math.max(MIN_HALF_EXTENT_METERS, halfX * absCosAzimuth + halfZ * absSinAzimuth);
  const halfScreenHeight = Math.max(
    MIN_HALF_EXTENT_METERS,
    (halfX * absSinAzimuth + halfZ * absCosAzimuth) * sinElevation + halfY * cosElevation,
  );

  const clampedMargin = Math.min(Math.max(marginRatio, 0), MAX_FIT_MARGIN_RATIO);
  const usableShare = 1 - 2 * clampedMargin;
  const zoomByWidth = (viewport.width * usableShare) / (2 * halfScreenWidth);
  const zoomByHeight = (viewport.height * usableShare) / (2 * halfScreenHeight);

  return {
    target: {
      x: (viewBox.minX + viewBox.maxX) / 2,
      y: (viewBox.minY + viewBox.maxY) / 2,
      z: (viewBox.minZ + viewBox.maxZ) / 2,
    },
    zoom: Math.max(MIN_ZOOM, Math.min(zoomByWidth, zoomByHeight)),
  };
};

export const getCameraClipping = (viewBox: SceneViewBoxValue): CameraClippingValue => {
  const diagonal = Math.hypot(
    viewBox.maxX - viewBox.minX,
    viewBox.maxY - viewBox.minY,
    viewBox.maxZ - viewBox.minZ,
  );
  const distance = Math.max(MIN_CAMERA_DISTANCE_METERS, diagonal * CAMERA_DISTANCE_DIAGONALS);

  return {
    distance,
    far: distance + diagonal + FAR_PADDING_METERS,
    near: NEAR_PLANE_METERS,
  };
};
