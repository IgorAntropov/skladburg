import type { BufferGeometry } from 'three';

import {
  InstancedBufferAttribute,
  PlaneGeometry,
} from 'three';

import type { SiteMarkSetValue } from './buildSiteMarkSet';

import {
  SITE_BANNER_CELL_FAR_ATTRIBUTE,
  SITE_BANNER_CELL_NEAR_ATTRIBUTE,
} from './createSiteBannerMaterial';

export const SITE_BANNER_CELL_ITEM_SIZE = 4;

export const createSiteBannerGeometry = (set: SiteMarkSetValue): BufferGeometry => {
  const geometry = new PlaneGeometry(1, 1);

  geometry.setAttribute(
    SITE_BANNER_CELL_NEAR_ATTRIBUTE,
    new InstancedBufferAttribute(set.nearCells, SITE_BANNER_CELL_ITEM_SIZE),
  );
  geometry.setAttribute(
    SITE_BANNER_CELL_FAR_ATTRIBUTE,
    new InstancedBufferAttribute(set.farCells, SITE_BANNER_CELL_ITEM_SIZE),
  );

  return geometry;
};
