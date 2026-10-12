import type { SceneBoundsValue } from '../world/sceneBounds';

export const ISOMETRIC_AZIMUTH_RADIANS = Math.PI / 4;

export const ISOMETRIC_ELEVATION_RADIANS = Math.atan(1 / Math.SQRT2);

export const DEFAULT_FIT_MARGIN_RATIO = 0.06;

const MAX_FIT_MARGIN_RATIO = 0.45;
const MIN_HALF_EXTENT_METERS = 0.5;
const MIN_ZOOM = 0.001;
const MIN_CAMERA_DISTANCE_METERS = 10;
const CAMERA_DISTANCE_DIAGONALS = 2;
const FAR_PADDING_METERS = 20;
const NEAR_PLANE_METERS = 0.1;

export interface FitBoundsOptionsValue {
  bounds: SceneBoundsValue;
  marginRatio?: number | undefined;
  viewport: ViewportSizeValue;
}

export interface IsometricFitValue {
  far: number;
  near: number;
  position: Vector3TupleValue;
  target: Vector3TupleValue;
  zoom: number;
}

export type Vector3TupleValue = readonly [number, number, number];

export interface ViewportSizeValue {
  height: number;
  width: number;
}

export const fitBoundsToViewport = ({
  bounds,
  marginRatio = DEFAULT_FIT_MARGIN_RATIO,
  viewport,
}: FitBoundsOptionsValue): IsometricFitValue => {
  const sinAzimuth = Math.sin(ISOMETRIC_AZIMUTH_RADIANS);
  const cosAzimuth = Math.cos(ISOMETRIC_AZIMUTH_RADIANS);
  const sinElevation = Math.sin(ISOMETRIC_ELEVATION_RADIANS);
  const cosElevation = Math.cos(ISOMETRIC_ELEVATION_RADIANS);

  const sizeX = bounds.maxX - bounds.minX;
  const sizeZ = bounds.maxZ - bounds.minZ;
  const halfX = sizeX / 2;
  const halfZ = sizeZ / 2;

  const halfScreenWidth = Math.max(MIN_HALF_EXTENT_METERS, halfX * Math.abs(cosAzimuth) + halfZ * Math.abs(sinAzimuth));
  const halfScreenHeight = Math.max(
    MIN_HALF_EXTENT_METERS,
    (halfX * Math.abs(sinAzimuth) + halfZ * Math.abs(cosAzimuth)) * sinElevation,
  );

  const clampedMargin = Math.min(Math.max(marginRatio, 0), MAX_FIT_MARGIN_RATIO);
  const usableShare = 1 - 2 * clampedMargin;
  const zoomByWidth = (viewport.width * usableShare) / (2 * halfScreenWidth);
  const zoomByHeight = (viewport.height * usableShare) / (2 * halfScreenHeight);

  const diagonal = Math.hypot(sizeX, sizeZ);
  const distance = Math.max(MIN_CAMERA_DISTANCE_METERS, diagonal * CAMERA_DISTANCE_DIAGONALS);
  const target: Vector3TupleValue = [(bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2];

  return {
    far: distance + diagonal + FAR_PADDING_METERS,
    near: NEAR_PLANE_METERS,
    position: [
      target[0] + distance * cosElevation * sinAzimuth,
      distance * sinElevation,
      target[2] + distance * cosElevation * cosAzimuth,
    ],
    target,
    zoom: Math.max(MIN_ZOOM, Math.min(zoomByWidth, zoomByHeight)),
  };
};
