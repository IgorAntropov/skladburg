import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  MINI_CITY_BUILDING_MAX_SIDE_METERS,
  MINI_CITY_RADIUS_METERS,
  MINI_CITY_SLOT_PITCH_METERS,
} from './layoutConstants';
import {
  getMiniCityRadiusForLevel,
  getMiniCitySlots,
  MINI_CITY_BASE_SLOT_COUNT,
} from './miniCitySlots';

describe('mini city slots', () => {
  it('has a center slot and enough base slots for a small city', () => {
    const slots = getMiniCitySlots(MINI_CITY_RADIUS_METERS);

    expect(slots[0]).toEqual({ x: 0, z: 0 });
    expect(MINI_CITY_BASE_SLOT_COUNT).toBe(slots.length);
    expect(MINI_CITY_BASE_SLOT_COUNT).toBeGreaterThanOrEqual(9);
  });

  it('keeps the worst case building of every slot inside the radius', () => {
    const halfDiagonal = MINI_CITY_BUILDING_MAX_SIDE_METERS * Math.SQRT1_2;

    for (const level of [0, 1, 2]) {
      const radius = getMiniCityRadiusForLevel(level);

      for (const slot of getMiniCitySlots(radius)) {
        expect(Math.hypot(slot.x, slot.z) + halfDiagonal).toBeLessThanOrEqual(radius + 1e-9);
      }
    }
  });

  it('keeps slots a building apart', () => {
    const slots = getMiniCitySlots(getMiniCityRadiusForLevel(2));

    for (const [index, slot] of slots.entries()) {
      for (const other of slots.slice(index + 1)) {
        const isSeparated = Math.abs(slot.x - other.x) >= MINI_CITY_BUILDING_MAX_SIDE_METERS
          || Math.abs(slot.z - other.z) >= MINI_CITY_BUILDING_MAX_SIDE_METERS;

        expect(isSeparated).toBe(true);
      }
    }
  });

  it('lists slots from the center outward and keeps the smaller city as a prefix of the larger one', () => {
    const base = getMiniCitySlots(getMiniCityRadiusForLevel(0));
    const larger = getMiniCitySlots(getMiniCityRadiusForLevel(1));
    const distances = larger.map(slot => Math.hypot(slot.x, slot.z));

    expect(larger.length).toBeGreaterThan(base.length);
    expect(larger.slice(0, base.length)).toEqual(base);
    expect(distances).toEqual(distances.toSorted((current, prev) => current - prev));
  });

  it('grows the radius by the pitch per level', () => {
    expect(getMiniCityRadiusForLevel(0)).toBe(MINI_CITY_RADIUS_METERS);
    expect(getMiniCityRadiusForLevel(2)).toBeCloseTo(MINI_CITY_RADIUS_METERS + 2 * MINI_CITY_SLOT_PITCH_METERS, 9);
  });

  it('gives no slots for a city too small for a building', () => {
    expect(getMiniCitySlots(0.5)).toEqual([]);
  });
});
