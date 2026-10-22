import type { NetworkMapSelectionValue } from '../../model/networkSceneInteraction';
import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from '../layout';

import { EMPTY_ID_LIST } from '../../model/networkSceneInteraction';
import { CITY_RESERVE_RADIUS_METERS } from '../layout';
import {
  CITY_CORNER_BAR_WIDTH_METERS,
  CITY_CORNER_INNER_SHARE,
  CITY_CORNER_LENGTH_METERS,
  CORNER_OUTLINE_METERS,
  SITE_CORNER_BAR_WIDTH_METERS,
  SITE_CORNER_GAP_METERS,
  SITE_CORNER_LENGTH_METERS,
} from './networkSceneMetrics';

export interface SelectionFrameValue {
  barLength: number;
  barWidth: number;
  centerX: number;
  centerZ: number;
  innerHalfX: number;
  innerHalfZ: number;
}

const MAX_CITY_INNER_HALF_METERS = CITY_RESERVE_RADIUS_METERS * Math.SQRT1_2 - CITY_CORNER_BAR_WIDTH_METERS - CORNER_OUTLINE_METERS;

const createSiteFrame = (building: NetworkSceneBuildingValue): SelectionFrameValue => {
  const cosine = Math.abs(Math.cos(building.rotation));
  const sine = Math.abs(Math.sin(building.rotation));

  return {
    barLength: SITE_CORNER_LENGTH_METERS,
    barWidth: SITE_CORNER_BAR_WIDTH_METERS,
    centerX: building.x,
    centerZ: building.z,
    innerHalfX: (building.width * cosine + building.depth * sine) / 2 + SITE_CORNER_GAP_METERS,
    innerHalfZ: (building.width * sine + building.depth * cosine) / 2 + SITE_CORNER_GAP_METERS,
  };
};

const createCityFrame = (city: NetworkSceneCityValue): SelectionFrameValue => {
  const innerHalf = Math.min(city.radius * CITY_CORNER_INNER_SHARE, MAX_CITY_INNER_HALF_METERS);

  return {
    barLength: CITY_CORNER_LENGTH_METERS,
    barWidth: CITY_CORNER_BAR_WIDTH_METERS,
    centerX: city.x,
    centerZ: city.z,
    innerHalfX: innerHalf,
    innerHalfZ: innerHalf,
  };
};

export const listSelectedIds = (selected: NetworkMapSelectionValue | undefined): readonly string[] => {
  if (selected === undefined) {
    return EMPTY_ID_LIST;
  }

  return selected.kind === 'sites' ? selected.siteIds : [selected.id];
};

export const resolveSelectionFrames = (
  buildings: readonly NetworkSceneBuildingValue[],
  cities: readonly NetworkSceneCityValue[],
  ids: readonly string[],
): readonly SelectionFrameValue[] => {
  const frames: SelectionFrameValue[] = [];
  const framedSiteIds = new Set<string>();
  const framedCityIds = new Set<string>();

  for (const id of ids) {
    const building = buildings.find(candidate => candidate.isCompany && candidate.siteId === id);

    if (building !== undefined) {
      if (!framedSiteIds.has(id)) {
        framedSiteIds.add(id);
        frames.push(createSiteFrame(building));
      }

      continue;
    }

    const city = cities.find(candidate => candidate.id === id || candidate.hiddenSiteIds.includes(id));

    if (city !== undefined && !framedCityIds.has(city.id)) {
      framedCityIds.add(city.id);
      frames.push(createCityFrame(city));
    }
  }

  return frames;
};
