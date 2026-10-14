import type { SceneWorldValue } from '../world/sceneWorld';

export interface ShadowFrustumValue {
  centerX: number;
  centerY: number;
  centerZ: number;
  distance: number;
  far: number;
  halfExtent: number;
  near: number;
}

const SHADOW_CLEARANCE_METERS = 4;
const HALF = 0.5;

export const computeShadowFrustum = (world: SceneWorldValue): ShadowFrustumValue => {
  const { bounds, maxHeight } = world;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const halfExtent = Math.hypot(width, depth, maxHeight) * HALF;
  const distance = halfExtent + SHADOW_CLEARANCE_METERS;

  return {
    centerX: (bounds.minX + bounds.maxX) * HALF,
    centerY: maxHeight * HALF,
    centerZ: (bounds.minZ + bounds.maxZ) * HALF,
    distance,
    far: distance + halfExtent + SHADOW_CLEARANCE_METERS,
    halfExtent,
    near: SHADOW_CLEARANCE_METERS * HALF,
  };
};
