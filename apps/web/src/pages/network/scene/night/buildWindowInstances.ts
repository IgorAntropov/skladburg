import type { InstanceTransformValue } from '../geometry/composeInstanceMatrix';
import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from '../layout';
import type { ModelWindowSourcesValue } from '../mix/createModelWindowSources';

import { BUILDING_PART_RULES } from '../geometry/buildBuildingParts';
import {
  INSTANCE_MATRIX_ITEM_SIZE,
  writeInstanceMatrix,
} from '../geometry/composeInstanceMatrix';
import {
  getVisibleBuildingCount,
  hashUnit,
  MINI_CITY_RADIUS_METERS,
  orderBuildingsForDensity,
} from '../layout';
import { NETWORK_WORLD_SEED } from '../networkWorldConstants';
import {
  clampUnit,
  computeWindowDelay,
  getFarthestCityDistance,
  toDistanceUnit,
} from './glowDelays';
import { listModelFarWindowTransforms } from './listModelFarWindowTransforms';
import { listModelWindowTransforms } from './listModelWindowTransforms';
import {
  DARK_WINDOW_DELAY,
  DARK_WINDOW_SHARE,
  NIGHT_SALT,
  WINDOW_STANDOFF_METERS,
} from './nightConstants';
import { getWallSlots } from './wallWindowSlots';

export interface WindowInstancesValue {
  buildings: readonly NetworkSceneBuildingValue[];
  count: number;
  delays: Float32Array;
  getVisibleCount: (density: number) => number;
  matrices: Float32Array;
  windowEnds: Uint32Array;
}

export interface WindowSetsValue {
  far: WindowInstancesValue;
  near: WindowInstancesValue;
}

interface BuildingGlowFrameValue {
  city: CityFrameValue;
  cityUnit: number;
}

interface CityFrameValue {
  radius: number;
  x: number;
  z: number;
}

interface WallFaceValue {
  isAlongWidth: boolean;
  yaw: number;
}

interface WindowDraftValue {
  delay: number;
  transform: InstanceTransformValue;
}

type WindowSetKindValue = 'far' | 'near';

const EMPTY_MODEL_WINDOWS: ModelWindowSourcesValue = new Map();

const WALL_FACES: readonly WallFaceValue[] = [
  { isAlongWidth: true, yaw: 0 },
  { isAlongWidth: false, yaw: Math.PI / 2 },
  { isAlongWidth: true, yaw: Math.PI },
  { isAlongWidth: false, yaw: -Math.PI / 2 },
];

const WALL_RULES = BUILDING_PART_RULES.filter(rule => rule.key === 'buildingWall' || rule.key === 'warehouseWall');

const getWallTransform = (building: NetworkSceneBuildingValue): InstanceTransformValue => {
  const rule = WALL_RULES.find(candidate => candidate.kinds.includes(building.kind));

  if (rule === undefined) {
    throw new Error(`No wall rule for ${building.kind}`);
  }

  return rule.transform(building);
};

const resolveCityFrame = (
  building: NetworkSceneBuildingValue,
  cityById: ReadonlyMap<string, NetworkSceneCityValue>,
): CityFrameValue => cityById.get(building.cityId) ?? { radius: MINI_CITY_RADIUS_METERS, x: building.x, z: building.z };

const listBoxWindowTransforms = (building: NetworkSceneBuildingValue): InstanceTransformValue[] => {
  const wall = getWallTransform(building);
  const transforms: InstanceTransformValue[] = [];

  for (const face of WALL_FACES) {
    const wallLength = face.isAlongWidth ? building.width : building.depth;
    const standoff = (face.isAlongWidth ? building.depth : building.width) / 2 + WINDOW_STANDOFF_METERS;
    const yaw = building.rotation + face.yaw;
    const sine = Math.sin(yaw);
    const cosine = Math.cos(yaw);

    for (const slot of getWallSlots(building.kind, wallLength, wall.scale[1])) {
      transforms.push({
        rotationY: yaw,
        scale: [slot.width, slot.height, 1],
        x: building.x + slot.offset * cosine + standoff * sine,
        y: wall.y + slot.rise,
        z: building.z - slot.offset * sine + standoff * cosine,
      });
    }
  }

  return transforms;
};

const draftWindow = (
  keyPrefix: string,
  index: number,
  transform: InstanceTransformValue,
  { city, cityUnit }: BuildingGlowFrameValue,
): WindowDraftValue => {
  const windowKey = [keyPrefix, index].join(':');
  const isDark = hashUnit(NETWORK_WORLD_SEED, windowKey, NIGHT_SALT.windowDark) < DARK_WINDOW_SHARE;

  return {
    delay: isDark
      ? DARK_WINDOW_DELAY
      : computeWindowDelay({
          cityUnit,
          hashUnit: hashUnit(NETWORK_WORLD_SEED, windowKey, NIGHT_SALT.windowDelay),
          localUnit: clampUnit(Math.hypot(transform.x - city.x, transform.z - city.z) / city.radius),
        }),
    transform,
  };
};

const draftBuildingWindows = (
  building: NetworkSceneBuildingValue,
  cityById: ReadonlyMap<string, NetworkSceneCityValue>,
  farthestCityDistance: number,
  modelWindows: ModelWindowSourcesValue,
  kind: WindowSetKindValue,
): WindowDraftValue[] => {
  const city = resolveCityFrame(building, cityById);
  const frame: BuildingGlowFrameValue = { city, cityUnit: toDistanceUnit(Math.hypot(city.x, city.z), farthestCityDistance) };
  const source = modelWindows.get(building.id);

  if (source === undefined) {
    return listBoxWindowTransforms(building).map((transform, index) => draftWindow(building.id, index, transform, frame));
  }

  if (kind === 'far') {
    return listModelFarWindowTransforms(building, source)
      .map((transform, index) => draftWindow(`${building.id}:far`, index, transform, frame));
  }

  return listModelWindowTransforms(building, source).map((transform, index) => draftWindow(building.id, index, transform, frame));
};

const assembleWindowInstances = (
  ordered: readonly NetworkSceneBuildingValue[],
  cities: readonly NetworkSceneCityValue[],
  modelWindows: ModelWindowSourcesValue,
  kind: WindowSetKindValue,
): WindowInstancesValue => {
  const cityById = new Map(cities.map(city => [city.id, city]));
  const farthestCityDistance = getFarthestCityDistance(cities);
  const drafts: WindowDraftValue[] = [];
  const windowEnds = new Uint32Array(ordered.length);

  for (const [index, building] of ordered.entries()) {
    drafts.push(...draftBuildingWindows(building, cityById, farthestCityDistance, modelWindows, kind));
    windowEnds[index] = drafts.length;
  }

  const matrices = new Float32Array(drafts.length * INSTANCE_MATRIX_ITEM_SIZE);
  const delays = new Float32Array(drafts.length);

  for (const [index, draft] of drafts.entries()) {
    writeInstanceMatrix(matrices, index, draft.transform);
    delays[index] = draft.delay;
  }

  const getVisibleCount = (density: number): number => {
    const visibleBuildings = getVisibleBuildingCount(ordered, density);

    return visibleBuildings === 0 ? 0 : (windowEnds[visibleBuildings - 1] ?? 0);
  };

  return { buildings: ordered, count: drafts.length, delays, getVisibleCount, matrices, windowEnds };
};

export const buildWindowInstances = (
  buildings: readonly NetworkSceneBuildingValue[],
  cities: readonly NetworkSceneCityValue[],
  modelWindows: ModelWindowSourcesValue = EMPTY_MODEL_WINDOWS,
): WindowInstancesValue => assembleWindowInstances(orderBuildingsForDensity(buildings), cities, modelWindows, 'near');

export const buildWindowSets = (
  buildings: readonly NetworkSceneBuildingValue[],
  cities: readonly NetworkSceneCityValue[],
  modelWindows: ModelWindowSourcesValue = EMPTY_MODEL_WINDOWS,
): WindowSetsValue => {
  const ordered = orderBuildingsForDensity(buildings);

  return {
    far: assembleWindowInstances(ordered, cities, modelWindows, 'far'),
    near: assembleWindowInstances(ordered, cities, modelWindows, 'near'),
  };
};
