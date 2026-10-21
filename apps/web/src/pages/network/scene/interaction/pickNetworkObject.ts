import type { NetworkMapTargetValue } from '../../model/networkSceneInteraction';

export interface PickCandidatesValue {
  cities: PickCityValue[];
  sites: PickSiteValue[];
}

export interface PickCityValue {
  id: string;
  radiusX: number;
  radiusY: number;
  x: number;
  y: number;
}

export interface PickPointerValue {
  x: number;
  y: number;
}

export interface PickSiteValue {
  baseX: number;
  baseY: number;
  id: string;
  reachPx: number;
  tipX: number;
  tipY: number;
}

export const TOUCH_CAPTURE_RADIUS_PX = 22;

export const MOUSE_CAPTURE_RADIUS_PX = 12;

export const resolveCaptureRadius = (pointerType: string): number =>
  (pointerType === 'mouse' ? MOUSE_CAPTURE_RADIUS_PX : TOUCH_CAPTURE_RADIUS_PX);

const getSegmentDistance = (pointer: PickPointerValue, site: PickSiteValue): number => {
  const directionX = site.tipX - site.baseX;
  const directionY = site.tipY - site.baseY;
  const lengthSquared = directionX * directionX + directionY * directionY;
  const projection = lengthSquared > 0
    ? ((pointer.x - site.baseX) * directionX + (pointer.y - site.baseY) * directionY) / lengthSquared
    : 0;
  const clamped = Math.min(1, Math.max(0, projection));

  return Math.hypot(pointer.x - (site.baseX + directionX * clamped), pointer.y - (site.baseY + directionY * clamped));
};

const getEllipseScore = (pointer: PickPointerValue, city: PickCityValue, radiusPx: number): number => {
  const offsetX = (pointer.x - city.x) / (city.radiusX + radiusPx);
  const offsetY = (pointer.y - city.y) / (city.radiusY + radiusPx);

  return offsetX * offsetX + offsetY * offsetY;
};

const pickSite = (pointer: PickPointerValue, sites: readonly PickSiteValue[], radiusPx: number): string | undefined => {
  let bestId: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const site of sites) {
    const distance = getSegmentDistance(pointer, site);
    const isInReach = distance <= radiusPx + site.reachPx;
    const isCloser = distance < bestDistance || (distance === bestDistance && bestId !== undefined && site.id < bestId);

    if (isInReach && isCloser) {
      bestId = site.id;
      bestDistance = distance;
    }
  }

  return bestId;
};

const pickCity = (pointer: PickPointerValue, cities: readonly PickCityValue[], radiusPx: number): string | undefined => {
  let bestId: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const city of cities) {
    const score = getEllipseScore(pointer, city, radiusPx);
    const isCloser = score < bestScore || (score === bestScore && bestId !== undefined && city.id < bestId);

    if (score <= 1 && isCloser) {
      bestId = city.id;
      bestScore = score;
    }
  }

  return bestId;
};

export const pickNetworkObject = (
  pointer: PickPointerValue,
  candidates: PickCandidatesValue,
  radiusPx: number,
): NetworkMapTargetValue | undefined => {
  const siteId = pickSite(pointer, candidates.sites, radiusPx);

  if (siteId !== undefined) {
    return { id: siteId, kind: 'site' };
  }

  const cityId = pickCity(pointer, candidates.cities, radiusPx);

  return cityId === undefined ? undefined : { id: cityId, kind: 'city' };
};
