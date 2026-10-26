import type { IUniform } from 'three';

import { Vector2 } from 'three';

import {
  SITE_MARK_FAR_SIZE_METERS,
  SITE_MARK_NEAR_HEIGHT_METERS,
  SITE_MARK_NEAR_WIDTH_METERS,
} from './siteMarkMetrics';

export interface SiteBannerUniformsValue {
  far: IUniform<number>;
  farSize: IUniform<Vector2>;
  nearSize: IUniform<Vector2>;
}

export const createSiteBannerUniforms = (): SiteBannerUniformsValue => ({
  far: { value: 1 },
  farSize: { value: new Vector2(SITE_MARK_FAR_SIZE_METERS, SITE_MARK_FAR_SIZE_METERS) },
  nearSize: { value: new Vector2(SITE_MARK_NEAR_WIDTH_METERS, SITE_MARK_NEAR_HEIGHT_METERS) },
});

export const writeSiteBannerFar = (uniforms: SiteBannerUniformsValue, isFar: boolean): void => {
  uniforms.far.value = isFar ? 1 : 0;
};
