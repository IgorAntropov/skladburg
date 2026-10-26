import { SITE_BANNER_LOGO_FIELD } from './siteBannerTemplate';

export interface SiteBannerLogoPlacementValue {
  height: number;
  width: number;
  x: number;
  y: number;
}

export const fitSiteBannerLogo = (width: number, height: number): SiteBannerLogoPlacementValue | undefined => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  const scale = Math.min(1, SITE_BANNER_LOGO_FIELD.widthPx / width, SITE_BANNER_LOGO_FIELD.heightPx / height);
  const fittedWidth = width * scale;
  const fittedHeight = height * scale;

  return {
    height: fittedHeight,
    width: fittedWidth,
    x: SITE_BANNER_LOGO_FIELD.centerXPx - fittedWidth / 2,
    y: SITE_BANNER_LOGO_FIELD.centerYPx - fittedHeight / 2,
  };
};
