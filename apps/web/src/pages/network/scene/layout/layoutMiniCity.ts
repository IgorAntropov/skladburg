import type { MapSideValue } from '@/entities/network';

import type {
  LayoutPointValue,
  NetworkSceneBuildingKindValue,
  NetworkSceneBuildingValue,
} from './networkSceneTypes';

import {
  DECOR_MAX_COUNT,
  DECOR_MIN_COUNT,
  HOUSE_SIZE_RANGE_METERS,
  LAYOUT_SALT,
  OFFICE_SHARE,
  OFFICE_SIZE_RANGE_METERS,
  WAREHOUSE_SIZE_METERS,
} from './layoutConstants';
import {
  compareIds,
  hashIndex,
  hashUnit,
  lerpRange,
} from './layoutHash';
import {
  getMiniCityRadiusForLevel,
  getMiniCitySlots,
  MINI_CITY_BASE_SLOT_COUNT,
} from './miniCitySlots';

export interface LayoutMiniCityOptionsValue {
  center: LayoutPointValue;
  cityId: string;
  seed: number;
  sites: readonly MiniCitySiteValue[];
}

export interface MiniCityLayoutValue {
  buildings: readonly NetworkSceneBuildingValue[];
  radius: number;
}

export interface MiniCitySiteValue {
  id: string;
  isOwn: boolean;
  side: MapSideValue;
}

const QUARTER_TURN = Math.PI / 2;

const pickRotation = (seed: number, key: string, salt: number): number => (hashUnit(seed, key, salt) < 0.5 ? 0 : QUARTER_TURN);

const findFreeBaseSlot = (start: number, isTaken: (index: number) => boolean): number | undefined => {
  for (let step = 0; step < MINI_CITY_BASE_SLOT_COUNT; step += 1) {
    const index = (start + step) % MINI_CITY_BASE_SLOT_COUNT;

    if (!isTaken(index)) {
      return index;
    }
  }

  return undefined;
};

const resolveRadiusLevel = (siteCount: number): number => {
  let level = 0;

  while (getMiniCitySlots(getMiniCityRadiusForLevel(level)).length < siteCount) {
    level += 1;
  }

  return level;
};

const assignSiteSlots = (options: LayoutMiniCityOptionsValue, slotCount: number): Map<string, number> => {
  const { cityId, seed, sites } = options;
  const ordered = sites.toSorted((current, prev) => (
    hashUnit(seed, current.id, LAYOUT_SALT.siteOrder) - hashUnit(seed, prev.id, LAYOUT_SALT.siteOrder)
    || compareIds(current.id, prev.id)
  ));
  const slotBySiteId = new Map<string, number>();
  const takenSlots = new Set<number>();

  for (const site of ordered) {
    const start = hashIndex(seed, `${cityId}:${site.id}`, LAYOUT_SALT.siteSlot, MINI_CITY_BASE_SLOT_COUNT);
    let slotIndex = findFreeBaseSlot(start, index => takenSlots.has(index));

    for (let index = MINI_CITY_BASE_SLOT_COUNT; slotIndex === undefined && index < slotCount; index += 1) {
      if (!takenSlots.has(index)) {
        slotIndex = index;
      }
    }

    if (slotIndex !== undefined) {
      takenSlots.add(slotIndex);
      slotBySiteId.set(site.id, slotIndex);
    }
  }

  return slotBySiteId;
};

const createCompanyBuildings = (
  options: LayoutMiniCityOptionsValue,
  slots: readonly LayoutPointValue[],
  slotBySiteId: ReadonlyMap<string, number>,
): NetworkSceneBuildingValue[] => {
  const buildings: NetworkSceneBuildingValue[] = [];

  for (const site of options.sites) {
    const slot = slots[slotBySiteId.get(site.id) ?? -1];

    if (slot !== undefined) {
      buildings.push({
        cityId: options.cityId,
        depth: WAREHOUSE_SIZE_METERS.depth,
        height: WAREHOUSE_SIZE_METERS.height,
        id: site.id,
        isCompany: true,
        isOwn: site.isOwn,
        kind: 'warehouse',
        rank: 0,
        rotation: pickRotation(options.seed, site.id, LAYOUT_SALT.warehouseRotation),
        side: site.side,
        siteId: site.id,
        width: WAREHOUSE_SIZE_METERS.width,
        x: options.center.x + slot.x,
        z: options.center.z + slot.z,
      });
    }
  }

  return buildings.toSorted((current, prev) => compareIds(current.id, prev.id));
};

const createDecorBuilding = (
  options: LayoutMiniCityOptionsValue,
  index: number,
  slot: LayoutPointValue,
): NetworkSceneBuildingValue => {
  const { cityId, seed } = options;
  const id = ['decor', cityId, String(index)].join(':');
  const kind: NetworkSceneBuildingKindValue = hashUnit(seed, id, LAYOUT_SALT.decorKind) < OFFICE_SHARE ? 'office' : 'house';
  const sizeRange = kind === 'office' ? OFFICE_SIZE_RANGE_METERS : HOUSE_SIZE_RANGE_METERS;
  const widthUnit = hashUnit(seed, id, LAYOUT_SALT.decorSize);
  const depthUnit = hashUnit(seed, `${id}:depth`, LAYOUT_SALT.decorSize);
  const heightUnit = hashUnit(seed, `${id}:height`, LAYOUT_SALT.decorSize);

  return {
    cityId,
    depth: lerpRange(sizeRange.depth, depthUnit),
    height: lerpRange(sizeRange.height, heightUnit),
    id,
    isCompany: false,
    isOwn: false,
    kind,
    rank: hashUnit(seed, id, LAYOUT_SALT.decorRank),
    rotation: pickRotation(seed, id, LAYOUT_SALT.decorRotation),
    side: undefined,
    siteId: undefined,
    width: lerpRange(sizeRange.width, widthUnit),
    x: options.center.x + slot.x,
    z: options.center.z + slot.z,
  };
};

const createDecorBuildings = (
  options: LayoutMiniCityOptionsValue,
  baseSlots: readonly LayoutPointValue[],
  companySlotIndexes: ReadonlySet<number>,
): NetworkSceneBuildingValue[] => {
  const { cityId, seed } = options;
  const countSpan = DECOR_MAX_COUNT - DECOR_MIN_COUNT + 1;
  const count = DECOR_MIN_COUNT + hashIndex(seed, cityId, LAYOUT_SALT.decorCount, countSpan);
  const decorSlotIndexes = new Set<number>();
  const buildings: NetworkSceneBuildingValue[] = [];

  for (let index = 0; index < count; index += 1) {
    const start = hashIndex(seed, [cityId, String(index)].join(':'), LAYOUT_SALT.decorSlot, MINI_CITY_BASE_SLOT_COUNT);
    const slotIndex = findFreeBaseSlot(start, candidate => decorSlotIndexes.has(candidate));
    const slot = baseSlots[slotIndex ?? -1];

    if (slotIndex !== undefined && slot !== undefined) {
      decorSlotIndexes.add(slotIndex);

      if (!companySlotIndexes.has(slotIndex)) {
        buildings.push(createDecorBuilding(options, index, slot));
      }
    }
  }

  return buildings;
};

export const layoutMiniCity = (options: LayoutMiniCityOptionsValue): MiniCityLayoutValue => {
  const level = resolveRadiusLevel(options.sites.length);
  const radius = getMiniCityRadiusForLevel(level);
  const slots = getMiniCitySlots(radius);
  const baseSlots = getMiniCitySlots(getMiniCityRadiusForLevel(0));
  const slotBySiteId = assignSiteSlots(options, slots.length);
  const companies = createCompanyBuildings(options, slots, slotBySiteId);
  const decor = createDecorBuildings(options, baseSlots, new Set(slotBySiteId.values()));

  return { buildings: [...companies, ...decor], radius };
};
