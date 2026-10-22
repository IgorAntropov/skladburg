import type { ScenePointValue } from '@/shared/3d';

import type { NetworkMapTargetKindValue } from '../../model/networkSceneInteraction';
import type {
  NetworkSceneCityValue,
  NetworkSceneLayoutValue,
} from '../layout';

export interface NetworkFocusTargetValue {
  kind: NetworkMapTargetKindValue;
  point: ScenePointValue;
  radius: number;
}

export const FOCUS_MARGIN_METERS = 3;

export const MAX_FOCUS_ZOOM_FACTOR = 4;

const FOCUS_HEIGHT_METERS = 0;

const createCityTarget = (
  city: NetworkSceneCityValue,
  point: { x: number; z: number },
  kind: NetworkMapTargetKindValue,
): NetworkFocusTargetValue => ({
  kind,
  point: { x: point.x, y: FOCUS_HEIGHT_METERS, z: point.z },
  radius: city.radius + FOCUS_MARGIN_METERS,
});

const resolveSingleTarget = (layout: NetworkSceneLayoutValue, id: string): NetworkFocusTargetValue | undefined => {
  const building = layout.buildings.find(candidate => candidate.isCompany && candidate.siteId === id);

  if (building !== undefined) {
    const city = layout.cities.find(candidate => candidate.id === building.cityId);

    return city === undefined ? undefined : createCityTarget(city, building, 'site');
  }

  const hiddenSiteCity = layout.cities.find(candidate => candidate.hiddenSiteIds.includes(id));

  if (hiddenSiteCity !== undefined) {
    return createCityTarget(hiddenSiteCity, hiddenSiteCity, 'site');
  }

  const city = layout.cities.find(candidate => candidate.id === id);

  return city === undefined ? undefined : createCityTarget(city, city, 'city');
};

const mergeTargets = (current: NetworkFocusTargetValue, next: NetworkFocusTargetValue): NetworkFocusTargetValue => {
  const distance = Math.hypot(next.point.x - current.point.x, next.point.z - current.point.z);

  if (distance + next.radius <= current.radius) {
    return current;
  }

  if (distance + current.radius <= next.radius) {
    return next;
  }

  const radius = (distance + current.radius + next.radius) / 2;
  const share = (radius - current.radius) / distance;

  return {
    kind: 'site',
    point: {
      x: current.point.x + (next.point.x - current.point.x) * share,
      y: FOCUS_HEIGHT_METERS,
      z: current.point.z + (next.point.z - current.point.z) * share,
    },
    radius,
  };
};

const resolveSitesTarget = (layout: NetworkSceneLayoutValue, siteIds: readonly string[]): NetworkFocusTargetValue | undefined => {
  let enclosing: NetworkFocusTargetValue | undefined;

  for (const siteId of siteIds) {
    const target = resolveSingleTarget(layout, siteId);

    if (target !== undefined) {
      enclosing = enclosing === undefined ? { ...target, kind: 'site' } : mergeTargets(enclosing, target);
    }
  }

  return enclosing;
};

export const resolveNetworkFocusTarget = (
  layout: NetworkSceneLayoutValue,
  id: string,
  siteIds: readonly string[] | undefined,
): NetworkFocusTargetValue | undefined => (
  siteIds === undefined ? resolveSingleTarget(layout, id) : resolveSitesTarget(layout, siteIds)
);

export const resolveFocusZoomFactor = (homeRadius: number, focusRadius: number): number => {
  const ratio = focusRadius > 0 ? homeRadius / focusRadius : MAX_FOCUS_ZOOM_FACTOR;

  return Math.min(MAX_FOCUS_ZOOM_FACTOR, Math.max(1, ratio));
};
