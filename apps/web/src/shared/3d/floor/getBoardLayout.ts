import type {
  SceneBoundsValue,
  SceneViewBoxValue,
} from '../world/sceneBounds';

export interface BoardLayoutValue {
  body: BoardPartLayoutValue;
  rim: BoardPartLayoutValue;
  seam: BoardPartLayoutValue;
}

export interface BoardPartLayoutValue {
  position: [number, number, number];
  scale: [number, number, number];
}

export const SEAM_THICKNESS_METERS = 0.02;
export const BODY_MARGIN_METERS = 0.15;
export const BODY_THICKNESS_METERS = 0.5;
export const RIM_WIDTH_METERS = 0.55;
export const RIM_THICKNESS_METERS = 0.5;
export const RIM_DROP_METERS = 0.1;
export const TILE_HEIGHT_METERS = 0.12;

export const getBoardLayout = (bounds: SceneBoundsValue): BoardLayoutValue => {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const sizeX = bounds.maxX - bounds.minX;
  const sizeZ = bounds.maxZ - bounds.minZ;
  const bodyTop = -SEAM_THICKNESS_METERS;

  return {
    body: {
      position: [centerX, bodyTop - BODY_THICKNESS_METERS / 2, centerZ],
      scale: [sizeX + BODY_MARGIN_METERS * 2, BODY_THICKNESS_METERS, sizeZ + BODY_MARGIN_METERS * 2],
    },
    rim: {
      position: [centerX, -RIM_DROP_METERS - RIM_THICKNESS_METERS / 2, centerZ],
      scale: [sizeX + RIM_WIDTH_METERS * 2, RIM_THICKNESS_METERS, sizeZ + RIM_WIDTH_METERS * 2],
    },
    seam: {
      position: [centerX, -SEAM_THICKNESS_METERS / 2, centerZ],
      scale: [sizeX, SEAM_THICKNESS_METERS, sizeZ],
    },
  };
};

export const getBoardViewBox = (bounds: SceneBoundsValue): SceneViewBoxValue => ({
  maxX: bounds.maxX + RIM_WIDTH_METERS,
  maxY: TILE_HEIGHT_METERS,
  maxZ: bounds.maxZ + RIM_WIDTH_METERS,
  minX: bounds.minX - RIM_WIDTH_METERS,
  minY: -RIM_DROP_METERS - RIM_THICKNESS_METERS,
  minZ: bounds.minZ - RIM_WIDTH_METERS,
});
