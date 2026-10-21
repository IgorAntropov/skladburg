import type { InstanceTransformValue } from '../geometry/composeInstanceMatrix';
import type {
  NetworkSceneBuildingValue,
  NetworkSceneCityValue,
} from '../layout';

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
import {
  DARK_WINDOW_DELAY,
  DARK_WINDOW_SHARE,
  HOUSE_WINDOW_ROW_FRACTIONS,
  HOUSE_WINDOW_SIZE_METERS,
  NIGHT_SALT,
  OFFICE_WINDOW_ROW_FRACTIONS,
  WAREHOUSE_LONG_WALL_MIN_METERS,
  WAREHOUSE_LONG_WALL_OFFSETS_METERS,
  WAREHOUSE_SHORT_WALL_OFFSETS_METERS,
  WAREHOUSE_WINDOW_CENTER_HEIGHT_METERS,
  WAREHOUSE_WINDOW_SIZE_METERS,
  WINDOW_PAIR_OFFSET_METERS,
  WINDOW_SINGLE_WALL_MAX_METERS,
  WINDOW_STANDOFF_METERS,
} from './nightConstants';

export interface WindowInstancesValue {
  buildings: readonly NetworkSceneBuildingValue[];
  count: number;
  delays: Float32Array;
  getVisibleCount: (density: number) => number;
  matrices: Float32Array;
  windowEnds: Uint32Array;
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

interface WindowSlotValue {
  height: number;
  offset: number;
  rise: number;
  width: number;
}

const WALL_FACES: readonly WallFaceValue[] = [
  { isAlongWidth: true, yaw: 0 },
  { isAlongWidth: false, yaw: Math.PI / 2 },
  { isAlongWidth: true, yaw: Math.PI },
  { isAlongWidth: false, yaw: -Math.PI / 2 },
];

const WALL_RULES = BUILDING_PART_RULES.filter(rule => rule.key === 'buildingWall' || rule.key === 'warehouseWall');

const PAIR_OFFSETS: readonly number[] = [-WINDOW_PAIR_OFFSET_METERS, WINDOW_PAIR_OFFSET_METERS];

const SINGLE_OFFSETS: readonly number[] = [0];

const getWallSlots = (building: NetworkSceneBuildingValue, wallLength: number, wallHeight: number): WindowSlotValue[] => {
  if (building.kind === 'warehouse') {
    const offsets = wallLength >= WAREHOUSE_LONG_WALL_MIN_METERS
      ? WAREHOUSE_LONG_WALL_OFFSETS_METERS
      : WAREHOUSE_SHORT_WALL_OFFSETS_METERS;

    return offsets.map(offset => ({ ...WAREHOUSE_WINDOW_SIZE_METERS, offset, rise: WAREHOUSE_WINDOW_CENTER_HEIGHT_METERS }));
  }

  const fractions = building.kind === 'office' ? OFFICE_WINDOW_ROW_FRACTIONS : HOUSE_WINDOW_ROW_FRACTIONS;
  const offsets = wallLength < WINDOW_SINGLE_WALL_MAX_METERS ? SINGLE_OFFSETS : PAIR_OFFSETS;

  return fractions.flatMap(fraction => offsets.map(offset => ({
    ...HOUSE_WINDOW_SIZE_METERS,
    offset,
    rise: fraction * wallHeight,
  })));
};

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

const draftBuildingWindows = (
  building: NetworkSceneBuildingValue,
  cityById: ReadonlyMap<string, NetworkSceneCityValue>,
  farthestCityDistance: number,
): WindowDraftValue[] => {
  const wall = getWallTransform(building);
  const city = resolveCityFrame(building, cityById);
  const cityUnit = toDistanceUnit(Math.hypot(city.x, city.z), farthestCityDistance);
  const drafts: WindowDraftValue[] = [];

  for (const face of WALL_FACES) {
    const wallLength = face.isAlongWidth ? building.width : building.depth;
    const standoff = (face.isAlongWidth ? building.depth : building.width) / 2 + WINDOW_STANDOFF_METERS;
    const yaw = building.rotation + face.yaw;
    const sine = Math.sin(yaw);
    const cosine = Math.cos(yaw);

    for (const slot of getWallSlots(building, wallLength, wall.scale[1])) {
      const windowKey = [building.id, drafts.length].join(':');
      const x = building.x + slot.offset * cosine + standoff * sine;
      const z = building.z - slot.offset * sine + standoff * cosine;
      const isDark = hashUnit(NETWORK_WORLD_SEED, windowKey, NIGHT_SALT.windowDark) < DARK_WINDOW_SHARE;

      drafts.push({
        delay: isDark
          ? DARK_WINDOW_DELAY
          : computeWindowDelay({
              cityUnit,
              hashUnit: hashUnit(NETWORK_WORLD_SEED, windowKey, NIGHT_SALT.windowDelay),
              localUnit: clampUnit(Math.hypot(x - city.x, z - city.z) / city.radius),
            }),
        transform: { rotationY: yaw, scale: [slot.width, slot.height, 1], x, y: wall.y + slot.rise, z },
      });
    }
  }

  return drafts;
};

export const buildWindowInstances = (
  buildings: readonly NetworkSceneBuildingValue[],
  cities: readonly NetworkSceneCityValue[],
): WindowInstancesValue => {
  const ordered = orderBuildingsForDensity(buildings);
  const cityById = new Map(cities.map(city => [city.id, city]));
  const farthestCityDistance = getFarthestCityDistance(cities);
  const drafts: WindowDraftValue[] = [];
  const windowEnds = new Uint32Array(ordered.length);

  for (const [index, building] of ordered.entries()) {
    drafts.push(...draftBuildingWindows(building, cityById, farthestCityDistance));
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
