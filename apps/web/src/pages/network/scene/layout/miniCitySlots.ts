import type { LayoutPointValue } from './networkSceneTypes';

import {
  MINI_CITY_BUILDING_MAX_SIDE_METERS,
  MINI_CITY_RADIUS_METERS,
  MINI_CITY_SLOT_PITCH_METERS,
} from './layoutConstants';

const DISTANCE_PRECISION = 1e6;
const SLOT_EPSILON_METERS = 1e-9;
const HALF_DIAGONAL_METERS = MINI_CITY_BUILDING_MAX_SIDE_METERS * Math.SQRT1_2;

const slotsByRadius = new Map<number, readonly LayoutPointValue[]>();

const roundDistance = (distance: number): number => Math.round(distance * DISTANCE_PRECISION);

const createSlots = (radius: number): readonly LayoutPointValue[] => {
  const reach = radius - HALF_DIAGONAL_METERS + SLOT_EPSILON_METERS;
  const range = Math.max(0, Math.floor(reach / MINI_CITY_SLOT_PITCH_METERS));
  const slots: LayoutPointValue[] = [];

  for (let row = -range; row <= range; row += 1) {
    for (let column = -range; column <= range; column += 1) {
      const slot = { x: column * MINI_CITY_SLOT_PITCH_METERS, z: row * MINI_CITY_SLOT_PITCH_METERS };

      if (reach >= 0 && Math.hypot(slot.x, slot.z) <= reach) {
        slots.push(slot);
      }
    }
  }

  return slots.toSorted((current, prev) => (
    roundDistance(Math.hypot(current.x, current.z)) - roundDistance(Math.hypot(prev.x, prev.z))
    || current.z - prev.z
    || current.x - prev.x
  ));
};

export const getMiniCityRadiusForLevel = (level: number): number => MINI_CITY_RADIUS_METERS + level * MINI_CITY_SLOT_PITCH_METERS;

export const getMiniCitySlots = (radius: number): readonly LayoutPointValue[] => {
  const cached = slotsByRadius.get(radius);

  if (cached !== undefined) {
    return cached;
  }

  const slots = createSlots(radius);
  slotsByRadius.set(radius, slots);

  return slots;
};

export const MINI_CITY_BASE_SLOT_COUNT = getMiniCitySlots(MINI_CITY_RADIUS_METERS).length;
