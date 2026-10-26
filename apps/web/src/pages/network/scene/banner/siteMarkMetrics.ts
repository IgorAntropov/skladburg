export interface SiteMarkModeValue {
  isFar: boolean;
}

export const SITE_MARK_NEAR_WIDTH_METERS = 3.2;

export const SITE_MARK_NEAR_HEIGHT_METERS = 1.6;

export const SITE_MARK_FAR_SIZE_METERS = 2;

export const SITE_MARK_NEAR_ENTER_ZOOM = 22;

export const SITE_MARK_NEAR_EXIT_ZOOM_RATIO = 0.82;

export const SITE_MARK_NEAR_EXIT_ZOOM = SITE_MARK_NEAR_ENTER_ZOOM * SITE_MARK_NEAR_EXIT_ZOOM_RATIO;

export const SITE_MARK_NEAR_PICK_RADIUS_METERS = SITE_MARK_NEAR_WIDTH_METERS / 2;

export const SITE_MARK_FAR_PICK_RADIUS_METERS = SITE_MARK_FAR_SIZE_METERS / 2;

export const SITE_MARK_OWN_NEAR_RIGHT_METERS = -0.93;

export const SITE_MARK_OWN_NEAR_UP_METERS = 1.58;

export const SITE_MARK_OWN_FAR_RIGHT_METERS = 1.2;

export const SITE_MARK_OWN_FAR_UP_METERS = 1.05;

export const SITE_MARK_POST_WIDTH_METERS = 0.16;

export const SITE_MARK_POST_TOP_METERS = 2.5;

export const resolveSiteMarkIsFar = (zoomPxPerMeter: number, wasFar: boolean): boolean => {
  if (!Number.isFinite(zoomPxPerMeter) || zoomPxPerMeter <= 0) {
    return true;
  }

  return zoomPxPerMeter < (wasFar ? SITE_MARK_NEAR_ENTER_ZOOM : SITE_MARK_NEAR_EXIT_ZOOM);
};

export const createSiteMarkMode = (): SiteMarkModeValue => ({ isFar: true });

export const writeSiteMarkModeIsFar = (mode: SiteMarkModeValue, isFar: boolean): void => {
  mode.isFar = isFar;
};
