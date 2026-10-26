import type { MapSideValue } from '@/entities/network';

import { NETWORK_SIDES } from '../geometry/networkSides';
import {
  SITE_BANNER_FAR_SIZE_PX,
  SITE_BANNER_NEAR_HEIGHT_PX,
  SITE_BANNER_NEAR_WIDTH_PX,
} from './siteBannerTemplate';

export interface SiteBannerAtlasLayoutValue {
  capacity: number;
  height: number;
  nearColumns: number;
  nearOriginY: number;
  width: number;
}

export interface SiteBannerCellPixelsValue {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface SiteBannerCellUvValue {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export const SITE_BANNER_ATLAS_WIDTH_PX = 2048;

export const SITE_BANNER_ATLAS_MAX_HEIGHT_PX = 1024;

const HALF_TEXEL = 0.5;

const NEAR_COLUMNS = SITE_BANNER_ATLAS_WIDTH_PX / SITE_BANNER_NEAR_WIDTH_PX;

const SHARED_NEAR_CELLS = NETWORK_SIDES.length;

const readContentHeight = (organizationCount: number): number => (
  SITE_BANNER_FAR_SIZE_PX
  + Math.ceil((organizationCount + SHARED_NEAR_CELLS) / NEAR_COLUMNS) * SITE_BANNER_NEAR_HEIGHT_PX
);

const findCapacity = (): number => {
  let capacity = 0;

  while (readContentHeight(capacity + 1) <= SITE_BANNER_ATLAS_MAX_HEIGHT_PX) {
    capacity += 1;
  }

  return capacity;
};

export const SITE_BANNER_ATLAS_CAPACITY = findCapacity();

const ceilToPowerOfTwo = (value: number): number => 2 ** Math.ceil(Math.log2(value));

export const computeSiteBannerAtlasLayout = (organizationCount: number): SiteBannerAtlasLayoutValue => {
  const capacity = Math.max(0, Math.min(Math.floor(organizationCount), SITE_BANNER_ATLAS_CAPACITY));

  return {
    capacity,
    height: ceilToPowerOfTwo(readContentHeight(capacity)),
    nearColumns: NEAR_COLUMNS,
    nearOriginY: SITE_BANNER_FAR_SIZE_PX,
    width: SITE_BANNER_ATLAS_WIDTH_PX,
  };
};

const readNearSlotPixels = (layout: SiteBannerAtlasLayoutValue, slot: number): SiteBannerCellPixelsValue => ({
  height: SITE_BANNER_NEAR_HEIGHT_PX,
  width: SITE_BANNER_NEAR_WIDTH_PX,
  x: (slot % layout.nearColumns) * SITE_BANNER_NEAR_WIDTH_PX,
  y: layout.nearOriginY + Math.floor(slot / layout.nearColumns) * SITE_BANNER_NEAR_HEIGHT_PX,
});

export const readFarCellPixels = (side: MapSideValue): SiteBannerCellPixelsValue => ({
  height: SITE_BANNER_FAR_SIZE_PX,
  width: SITE_BANNER_FAR_SIZE_PX,
  x: Math.max(0, NETWORK_SIDES.indexOf(side)) * SITE_BANNER_FAR_SIZE_PX,
  y: 0,
});

export const readSharedNearCellPixels = (
  layout: SiteBannerAtlasLayoutValue,
  side: MapSideValue,
): SiteBannerCellPixelsValue => readNearSlotPixels(layout, Math.max(0, NETWORK_SIDES.indexOf(side)));

export const readNearCellPixels = (layout: SiteBannerAtlasLayoutValue, index: number): SiteBannerCellPixelsValue => (
  readNearSlotPixels(layout, SHARED_NEAR_CELLS + index)
);

export const toCellUv = (layout: SiteBannerAtlasLayoutValue, cell: SiteBannerCellPixelsValue): SiteBannerCellUvValue => ({
  u0: (cell.x + HALF_TEXEL) / layout.width,
  u1: (cell.x + cell.width - HALF_TEXEL) / layout.width,
  v0: 1 - (cell.y + cell.height - HALF_TEXEL) / layout.height,
  v1: 1 - (cell.y + HALF_TEXEL) / layout.height,
});
