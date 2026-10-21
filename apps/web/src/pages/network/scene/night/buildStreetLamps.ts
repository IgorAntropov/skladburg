import type {
  LayoutPointValue,
  NetworkSceneCityValue,
  NetworkSceneRoadValue,
} from '../layout';

import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from '../geometry/composeInstanceMatrix';
import {
  hashUnit,
  MINI_CITY_RADIUS_METERS,
} from '../layout';
import { NETWORK_WORLD_SEED } from '../networkWorldConstants';
import {
  computeLampDelay,
  getFarthestCityDistance,
  toDistanceUnit,
} from './glowDelays';
import {
  LAMP_CITY_CLEARANCE_MARGIN_METERS,
  LAMP_HEAD_CENTER_HEIGHT_METERS,
  LAMP_HEAD_SIZE_METERS,
  LAMP_MIN_WORK_LENGTH_METERS,
  LAMP_POOL_HEIGHT_METERS,
  LAMP_POOL_OFFSET_METERS,
  LAMP_POST_HEIGHT_METERS,
  LAMP_POST_OFFSET_METERS,
  LAMP_POST_SIZE_METERS,
  LAMP_RANK_START,
  LAMP_RANK_STEP,
  LAMP_SPACING_METERS,
  NIGHT_SALT,
} from './nightConstants';

export type StreetLampSideValue = -1 | 1;

export interface StreetLampsValue {
  count: number;
  delays: Float32Array;
  getVisibleCount: (density: number) => number;
  haloMatrices: Float32Array;
  headMatrices: Float32Array;
  lamps: readonly StreetLampValue[];
  poleMatrices: Float32Array;
  poolMatrices: Float32Array;
}

export interface StreetLampValue {
  delay: number;
  index: number;
  poolX: number;
  poolZ: number;
  postX: number;
  postZ: number;
  rank: number;
  roadId: string;
  side: StreetLampSideValue;
  yaw: number;
}

interface LampDraftValue {
  index: number;
  poolX: number;
  poolZ: number;
  postX: number;
  postZ: number;
  roadId: string;
  side: StreetLampSideValue;
  yaw: number;
}

const getRoadEndClearance = (
  cityId: string,
  cityById: ReadonlyMap<string, NetworkSceneCityValue>,
): number => (cityById.get(cityId)?.radius ?? MINI_CITY_RADIUS_METERS) + LAMP_CITY_CLEARANCE_MARGIN_METERS;

const getLampCount = (workLength: number): number =>
  workLength < LAMP_MIN_WORK_LENGTH_METERS ? 0 : Math.round(workLength / LAMP_SPACING_METERS);

const isInsideCityClearance = (point: LayoutPointValue, cities: readonly NetworkSceneCityValue[]): boolean =>
  cities.some(city => Math.hypot(point.x - city.x, point.z - city.z) < city.radius + LAMP_CITY_CLEARANCE_MARGIN_METERS);

const draftRoadLamps = (
  road: NetworkSceneRoadValue,
  cities: readonly NetworkSceneCityValue[],
  cityById: ReadonlyMap<string, NetworkSceneCityValue>,
): LampDraftValue[] => {
  const deltaX = road.to.x - road.from.x;
  const deltaZ = road.to.z - road.from.z;
  const length = Math.hypot(deltaX, deltaZ);
  const startClearance = getRoadEndClearance(road.fromCityId, cityById);
  const workLength = length - startClearance - getRoadEndClearance(road.toCityId, cityById);
  if (length === 0) {
    return [];
  }

  const lampCount = getLampCount(workLength);
  const directionX = deltaX / length;
  const directionZ = deltaZ / length;
  const yaw = Math.atan2(-directionZ, directionX);
  const drafts: LampDraftValue[] = [];

  for (let index = 0; index < lampCount; index += 1) {
    const along = startClearance + ((index + 0.5) * workLength) / lampCount;
    const side: StreetLampSideValue = index % 2 === 0 ? 1 : -1;
    const axisX = road.from.x + directionX * along;
    const axisZ = road.from.z + directionZ * along;
    const post = {
      x: axisX - directionZ * side * LAMP_POST_OFFSET_METERS,
      z: axisZ + directionX * side * LAMP_POST_OFFSET_METERS,
    };

    if (!isInsideCityClearance(post, cities)) {
      drafts.push({
        index,
        poolX: axisX - directionZ * side * LAMP_POOL_OFFSET_METERS,
        poolZ: axisZ + directionX * side * LAMP_POOL_OFFSET_METERS,
        postX: post.x,
        postZ: post.z,
        roadId: road.id,
        side,
        yaw,
      });
    }
  }

  return drafts;
};

const frac = (value: number): number => value - Math.floor(value);

export const getLampRank = (sequenceNumber: number): number => frac(LAMP_RANK_START + LAMP_RANK_STEP * sequenceNumber);

export const buildStreetLamps = (
  roads: readonly NetworkSceneRoadValue[],
  cities: readonly NetworkSceneCityValue[],
): StreetLampsValue => {
  const cityById = new Map(cities.map(city => [city.id, city]));
  const farthestCityDistance = getFarthestCityDistance(cities);
  const drafts = roads.flatMap(road => draftRoadLamps(road, cities, cityById));
  const lamps = drafts
    .map((draft, sequenceNumber): StreetLampValue => ({
      ...draft,
      delay: computeLampDelay({
        distanceUnit: toDistanceUnit(Math.hypot(draft.postX, draft.postZ), farthestCityDistance),
        hashUnit: hashUnit(NETWORK_WORLD_SEED, [draft.roadId, draft.index].join(':'), NIGHT_SALT.lampDelay),
      }),
      rank: getLampRank(sequenceNumber),
    }))
    .toSorted((current, prev) => current.rank - prev.rank);

  const size = lamps.length * INSTANCE_MATRIX_ITEM_SIZE;
  const poleMatrices = new Float32Array(size);
  const headMatrices = new Float32Array(size);
  const poolMatrices = new Float32Array(size);
  const haloMatrices = new Float32Array(size);
  const delays = new Float32Array(lamps.length);

  for (const [index, lamp] of lamps.entries()) {
    writeInstanceMatrix(poleMatrices, index, {
      rotationY: lamp.yaw,
      scale: [LAMP_POST_SIZE_METERS, LAMP_POST_HEIGHT_METERS, LAMP_POST_SIZE_METERS],
      x: lamp.postX,
      y: 0,
      z: lamp.postZ,
    });
    writeInstanceMatrix(headMatrices, index, {
      rotationY: lamp.yaw,
      scale: [LAMP_HEAD_SIZE_METERS.width, LAMP_HEAD_SIZE_METERS.height, LAMP_HEAD_SIZE_METERS.depth],
      x: lamp.postX,
      y: LAMP_POST_HEIGHT_METERS,
      z: lamp.postZ,
    });
    writeInstanceMatrix(poolMatrices, index, {
      rotationY: 0,
      scale: [1, 1, 1],
      x: lamp.poolX,
      y: LAMP_POOL_HEIGHT_METERS,
      z: lamp.poolZ,
    });
    writeInstanceMatrix(haloMatrices, index, {
      rotationY: 0,
      scale: [1, 1, 1],
      x: lamp.postX,
      y: LAMP_HEAD_CENTER_HEIGHT_METERS,
      z: lamp.postZ,
    });
    delays[index] = lamp.delay;
  }

  const getVisibleCount = (density: number): number => {
    let low = 0;
    let high = lamps.length;

    while (low < high) {
      const middle = (low + high) >>> 1;

      if ((lamps[middle]?.rank ?? Infinity) < density) {
        low = middle + 1;
      }
      else {
        high = middle;
      }
    }

    return low;
  };

  return { count: lamps.length, delays, getVisibleCount, haloMatrices, headMatrices, lamps, poleMatrices, poolMatrices };
};
