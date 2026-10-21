import {
  describe,
  expect,
  it,
} from 'vitest';

import { CITY_RESERVE_RADIUS_METERS } from './buildTerrainReserved';
import {
  MINI_CITY_BUILDING_MAX_SIDE_METERS,
  MINI_CITY_OVERFLOW_RADIUS_METERS,
  MINI_CITY_RADIUS_METERS,
} from './layoutConstants';
import {
  getMiniCitySlots,
  MINI_CITY_BASE_SLOT_COUNT,
  MINI_CITY_MAX_SITE_COUNT,
} from './miniCitySlots';

const RADII = [MINI_CITY_RADIUS_METERS, MINI_CITY_OVERFLOW_RADIUS_METERS, 12.8];

describe('mini city slots', () => {
  it('has a center slot and enough base slots for a small city', () => {
    const slots = getMiniCitySlots(MINI_CITY_RADIUS_METERS);

    expect(slots[0]).toEqual({ x: 0, z: 0 });
    expect(MINI_CITY_BASE_SLOT_COUNT).toBe(slots.length);
    expect(MINI_CITY_BASE_SLOT_COUNT).toBeGreaterThanOrEqual(9);
  });

  it('keeps the worst case building of every slot inside the radius', () => {
    const halfDiagonal = MINI_CITY_BUILDING_MAX_SIDE_METERS * Math.SQRT1_2;

    for (const radius of RADII) {
      for (const slot of getMiniCitySlots(radius)) {
        expect(Math.hypot(slot.x, slot.z) + halfDiagonal).toBeLessThanOrEqual(radius + 1e-9);
      }
    }
  });

  it('keeps slots a building apart', () => {
    const slots = getMiniCitySlots(RADII[2] ?? 0);

    for (const [index, slot] of slots.entries()) {
      for (const other of slots.slice(index + 1)) {
        const isSeparated = Math.abs(slot.x - other.x) >= MINI_CITY_BUILDING_MAX_SIDE_METERS
          || Math.abs(slot.z - other.z) >= MINI_CITY_BUILDING_MAX_SIDE_METERS;

        expect(isSeparated).toBe(true);
      }
    }
  });

  it('lists slots from the center outward and keeps the smaller city as a prefix of the larger one', () => {
    const base = getMiniCitySlots(MINI_CITY_RADIUS_METERS);
    const larger = getMiniCitySlots(MINI_CITY_OVERFLOW_RADIUS_METERS);
    const distances = larger.map(slot => Math.hypot(slot.x, slot.z));

    expect(larger.length).toBeGreaterThan(base.length);
    expect(larger.slice(0, base.length)).toEqual(base);
    expect(distances).toEqual(distances.toSorted((current, prev) => current - prev));
  });

  it('keeps the overflow city inside of the clearing of the terrain and with one ring more than the base', () => {
    expect(MINI_CITY_OVERFLOW_RADIUS_METERS).toBeLessThanOrEqual(CITY_RESERVE_RADIUS_METERS);
    expect(MINI_CITY_MAX_SITE_COUNT).toBeGreaterThan(MINI_CITY_BASE_SLOT_COUNT);
    expect(getMiniCitySlots(MINI_CITY_OVERFLOW_RADIUS_METERS).slice(0, MINI_CITY_BASE_SLOT_COUNT))
      .toEqual(getMiniCitySlots(MINI_CITY_RADIUS_METERS));
  });

  it('gives no slots for a city too small for a building', () => {
    expect(getMiniCitySlots(0.5)).toEqual([]);
  });
});
