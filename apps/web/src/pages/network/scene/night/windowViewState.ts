import { resolveSiteMarkIsFar } from '../banner/siteMarkMetrics';
import { FAR_WINDOW_MIN_NIGHT } from './nightConstants';

export interface WindowViewStateValue {
  isFarSet: boolean;
  isViewFar: boolean;
}

export const createWindowViewState = (): WindowViewStateValue => ({ isFarSet: false, isViewFar: true });

export const isFarWindowSetActive = (isViewFar: boolean, dayNight: number): boolean =>
  isViewFar && dayNight >= FAR_WINDOW_MIN_NIGHT;

export const updateWindowViewState = (
  view: WindowViewStateValue,
  zoomPxPerMeter: number,
  dayNight: number,
): boolean => {
  view.isViewFar = resolveSiteMarkIsFar(zoomPxPerMeter, view.isViewFar);

  const isFarSet = isFarWindowSetActive(view.isViewFar, dayNight);
  const isChanged = isFarSet !== view.isFarSet;

  view.isFarSet = isFarSet;

  return isChanged;
};
