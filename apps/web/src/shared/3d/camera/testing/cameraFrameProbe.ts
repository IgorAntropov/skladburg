import type { Camera } from 'three';

import {
  OrthographicCamera,
  Spherical,
  Vector3,
} from 'three';

import type { SceneInsetsValue } from '@/shared/lib/viewport';

import type { SceneBoundsValue } from '../../world/sceneBounds';
import type { ViewportSizeValue } from '../cameraTypes';

import { WORLD_EDGE_MARGIN_METERS } from '../../world/worldConstants';
import { ISOMETRIC_POLAR_RADIANS } from '../cameraConstants';
import { getFocusShift } from '../cameraWorld';

export interface FrameCaseValue {
  insets: SceneInsetsValue;
  name: string;
  viewport: ViewportSizeValue;
}

export interface PixelPointValue {
  x: number;
  y: number;
}

export const NDC_CORNERS: readonly PixelPointValue[] = [
  { x: -1, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
];

const ZERO_INSETS: SceneInsetsValue = { bottom: 0, left: 0, right: 0, top: 0 };
const DESKTOP_INSETS: SceneInsetsValue = { bottom: 56, left: 384, right: 384, top: 72 };
const LOPSIDED_INSETS: SceneInsetsValue = { bottom: 100, left: 0, right: 384, top: 72 };

const VIEWPORTS: readonly ViewportSizeValue[] = [
  { height: 800, width: 1280 },
  { height: 900, width: 1440 },
  { height: 1080, width: 1920 },
  { height: 1440, width: 2560 },
  { height: 1440, width: 3440 },
  { height: 2160, width: 3840 },
  { height: 768, width: 1024 },
  { height: 1194, width: 834 },
  { height: 844, width: 390 },
];

const TABLET_TOP_PX = 96;
const TABLET_BOTTOM_SHARE = 0.45;
const MAX_TABLET_WIDTH_PX = 1024;
const PHONE_WIDTH_PX = 390;

const getLayoutInsets = (viewport: ViewportSizeValue): SceneInsetsValue => {
  if (viewport.width <= PHONE_WIDTH_PX) {
    return ZERO_INSETS;
  }

  if (viewport.width <= MAX_TABLET_WIDTH_PX) {
    return { bottom: Math.round(viewport.height * TABLET_BOTTOM_SHARE), left: 0, right: 0, top: TABLET_TOP_PX };
  }

  return DESKTOP_INSETS;
};

export const FRAME_CASES: readonly FrameCaseValue[] = VIEWPORTS.flatMap((viewport): FrameCaseValue[] => {
  const size = `${String(viewport.width)}x${String(viewport.height)}`;

  return [
    { insets: ZERO_INSETS, name: `${size} without insets`, viewport },
    { insets: getLayoutInsets(viewport), name: `${size} with the layout insets`, viewport },
    { insets: LOPSIDED_INSETS, name: `${size} with lopsided insets`, viewport },
  ];
});

export interface PlacedFrameValue {
  azimuth: number;
  camera: OrthographicCamera;
  insets: SceneInsetsValue;
  viewport: ViewportSizeValue;
  zoom: number;
}

const CLIPPING_DISTANCE_METERS = 600;
const CLIPPING_FAR_METERS = 1200;

const offset = new Spherical();

export const createFrameCamera = (viewport: ViewportSizeValue): OrthographicCamera => {
  return new OrthographicCamera(
    -viewport.width / 2,
    viewport.width / 2,
    viewport.height / 2,
    -viewport.height / 2,
    0.1,
    CLIPPING_FAR_METERS,
  );
};

export const placeFrameCamera = (
  frame: PlacedFrameValue,
  target: Vector3,
): void => {
  const { azimuth, camera, insets, viewport, zoom } = frame;
  const shift = getFocusShift({ insets, viewport });

  camera.left = -viewport.width / 2;
  camera.right = viewport.width / 2;
  camera.top = viewport.height / 2;
  camera.bottom = -viewport.height / 2;
  camera.zoom = zoom;
  camera.setViewOffset(viewport.width, viewport.height, -shift.x, -shift.y, viewport.width, viewport.height);

  offset.set(CLIPPING_DISTANCE_METERS, ISOMETRIC_POLAR_RADIANS, azimuth);
  camera.position.setFromSpherical(offset).add(target);
  camera.lookAt(target);
  camera.updateMatrixWorld();
};

const ndcPoint = new Vector3();
const rayDirection = new Vector3();

export const intersectGround = (camera: Camera, ndcX: number, ndcY: number, out: Vector3): Vector3 => {
  ndcPoint.set(ndcX, ndcY, 0).unproject(camera);
  camera.getWorldDirection(rayDirection);

  return out.copy(ndcPoint).addScaledVector(rayDirection, -ndcPoint.y / rayDirection.y);
};

export const toPixels = (camera: Camera, point: Vector3, viewport: ViewportSizeValue, out: PixelPointValue): PixelPointValue => {
  ndcPoint.copy(point).project(camera);
  out.x = (ndcPoint.x + 1) / 2 * viewport.width;
  out.y = (1 - ndcPoint.y) / 2 * viewport.height;

  return out;
};

export const isInsideWorldWithMargin = (point: Vector3, bounds: SceneBoundsValue, tolerance = 1e-6): boolean => {
  const margin = WORLD_EDGE_MARGIN_METERS - tolerance;

  return point.x >= bounds.minX + margin
    && point.x <= bounds.maxX - margin
    && point.z >= bounds.minZ + margin
    && point.z <= bounds.maxZ - margin;
};

export const getWorstOverflow = (camera: Camera, bounds: SceneBoundsValue): number => {
  const corner = new Vector3();
  let worst = 0;

  for (const ndc of NDC_CORNERS) {
    intersectGround(camera, ndc.x, ndc.y, corner);
    worst = Math.max(
      worst,
      bounds.minX + WORLD_EDGE_MARGIN_METERS - corner.x,
      corner.x - (bounds.maxX - WORLD_EDGE_MARGIN_METERS),
      bounds.minZ + WORLD_EDGE_MARGIN_METERS - corner.z,
      corner.z - (bounds.maxZ - WORLD_EDGE_MARGIN_METERS),
    );
  }

  return worst;
};
