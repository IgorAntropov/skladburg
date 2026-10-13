import type { SceneInsetsValue } from '@/shared/lib/viewport';

import type { SceneBoundsValue } from '../world/sceneBounds';
import type { SceneWorldValue } from '../world/sceneWorld';
import type {
  CameraViewValue,
  FocusShiftValue,
  ViewportSizeValue,
} from './cameraTypes';

import {
  GROUND_HEIGHT_METERS,
  WORLD_EDGE_MARGIN_METERS,
} from '../world/worldConstants';
import {
  HOME_MARGIN_RATIO,
  ISOMETRIC_ELEVATION_RADIANS,
  MAX_ZOOM_PX_PER_METER,
  PAN_MIN_HALF_METERS,
} from './cameraConstants';

const MIN_ALLOWED_RADIUS_METERS = 1;
const MIN_FREE_EXTENT_PX = 1;
const SIN_ELEVATION = Math.sin(ISOMETRIC_ELEVATION_RADIANS);

export interface CameraClippingValue {
  distance: number;
  far: number;
  near: number;
}

export interface HomeViewOptionsValue {
  insets: SceneInsetsValue;
  viewport: ViewportSizeValue;
  world: SceneWorldValue;
}

export interface PanRegionOptionsValue {
  radius: number;
  world: SceneWorldValue;
}

export interface ViewFootprintOptionsValue {
  insets: SceneInsetsValue;
  viewport: ViewportSizeValue;
  zoom: number;
}

export interface ZoomLimitsOptionsValue {
  insets: SceneInsetsValue;
  viewport: ViewportSizeValue;
  world: SceneWorldValue;
}

export interface ZoomLimitsValue {
  max: number;
  min: number;
}

const CLIPPING_DISTANCE_DIAGONALS = 2;
const CLIPPING_PADDING_METERS = 20;
const MIN_CLIPPING_DISTANCE_METERS = 10;
const NEAR_PLANE_METERS = 0.1;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const getFocusShift = ({ insets, viewport }: Omit<ViewFootprintOptionsValue, 'zoom'>): FocusShiftValue => {
  const freeCenterX = (insets.left + (viewport.width - insets.right)) / 2;
  const freeCenterY = (insets.top + (viewport.height - insets.bottom)) / 2;

  return {
    x: freeCenterX - viewport.width / 2,
    y: freeCenterY - viewport.height / 2,
  };
};

export const getViewFootprintPx = ({ insets, viewport }: Omit<ViewFootprintOptionsValue, 'zoom'>): number => {
  const shift = getFocusShift({ insets, viewport });
  const maxAbsX = viewport.width / 2 + Math.abs(shift.x);
  const maxAbsY = viewport.height / 2 + Math.abs(shift.y);

  return Math.hypot(maxAbsX, maxAbsY / SIN_ELEVATION);
};

export const getViewFootprintRadius = ({ insets, viewport, zoom }: ViewFootprintOptionsValue): number => {
  return getViewFootprintPx({ insets, viewport }) / zoom;
};

export const getPanRegion = (
  { radius, world }: PanRegionOptionsValue,
  out: SceneBoundsValue = { maxX: 0, maxZ: 0, minX: 0, minZ: 0 },
): SceneBoundsValue => {
  const inset = radius + WORLD_EDGE_MARGIN_METERS;
  const { bounds } = world;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  out.minX = Math.min(bounds.minX + inset, centerX);
  out.maxX = Math.max(bounds.maxX - inset, centerX);
  out.minZ = Math.min(bounds.minZ + inset, centerZ);
  out.maxZ = Math.max(bounds.maxZ - inset, centerZ);

  return out;
};

export const getZoomLimits = ({ insets, viewport, world }: ZoomLimitsOptionsValue): ZoomLimitsValue => {
  const { bounds } = world;
  const halfExtent = Math.min(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2;
  const allowedRadius = Math.max(halfExtent - WORLD_EDGE_MARGIN_METERS - PAN_MIN_HALF_METERS, MIN_ALLOWED_RADIUS_METERS);
  const min = Math.max(getViewFootprintPx({ insets, viewport }), MIN_FREE_EXTENT_PX) / allowedRadius;

  return { max: Math.max(MAX_ZOOM_PX_PER_METER, min), min };
};

export const getHomeView = ({ insets, viewport, world }: HomeViewOptionsValue): CameraViewValue => {
  const freeWidth = Math.max(viewport.width - insets.left - insets.right, MIN_FREE_EXTENT_PX);
  const freeHeight = Math.max(viewport.height - insets.top - insets.bottom, MIN_FREE_EXTENT_PX);
  const usableShare = 1 - 2 * HOME_MARGIN_RATIO;
  const diameter = 2 * Math.max(world.home.radius, MIN_ALLOWED_RADIUS_METERS);
  const fitZoom = Math.min(
    (freeWidth * usableShare) / diameter,
    (freeHeight * usableShare) / (diameter * SIN_ELEVATION),
  );
  const limits = getZoomLimits({ insets, viewport, world });
  const zoom = clamp(fitZoom, limits.min, limits.max);
  const region = getPanRegion({ radius: getViewFootprintRadius({ insets, viewport, zoom }), world });

  return {
    target: {
      x: clamp(world.home.centerX, region.minX, region.maxX),
      y: GROUND_HEIGHT_METERS,
      z: clamp(world.home.centerZ, region.minZ, region.maxZ),
    },
    zoom,
  };
};

export const getWorldClipping = (world: SceneWorldValue): CameraClippingValue => {
  const { bounds } = world;
  const diagonal = Math.hypot(bounds.maxX - bounds.minX, world.maxHeight, bounds.maxZ - bounds.minZ);
  const distance = Math.max(MIN_CLIPPING_DISTANCE_METERS, diagonal * CLIPPING_DISTANCE_DIAGONALS);

  return {
    distance,
    far: distance + diagonal + CLIPPING_PADDING_METERS,
    near: NEAR_PLANE_METERS,
  };
};
