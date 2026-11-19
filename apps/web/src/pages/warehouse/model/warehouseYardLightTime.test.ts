import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  readWarehouseYardLightDelay,
  readWarehouseYardLightTime,
} from './warehouseYardLightTime';

describe('warehouse daylight', () => {
  it.each([
    [Date.UTC(2026, 10, 19, 2, 59, 59, 999), true, Date.UTC(2026, 10, 19, 3)],
    [Date.UTC(2026, 10, 19, 3), false, Date.UTC(2026, 10, 19, 15)],
    [Date.UTC(2026, 10, 19, 14, 59, 59, 999), false, Date.UTC(2026, 10, 19, 15)],
    [Date.UTC(2026, 10, 19, 15), true, Date.UTC(2026, 10, 20, 3)],
    [Date.UTC(2026, 10, 19, 21), true, Date.UTC(2026, 10, 20, 3)],
  ] as const)('at %s in Moscow', (now, isNight, next) => {
    expect(readWarehouseYardLightTime(now, 'Europe/Moscow')).toEqual({
      isNight,
      nextBoundaryMs: next,
    });
  });

  it('uses the warehouse zone independently of the viewer zone', () => {
    const instant = Date.UTC(2026, 10, 19, 13);

    expect(readWarehouseYardLightTime(instant, 'Europe/Moscow').isNight).toBe(false);
    expect(readWarehouseYardLightTime(instant, 'Asia/Tomsk').isNight).toBe(true);
    expect(readWarehouseYardLightTime(instant, 'Asia/Kathmandu').nextBoundaryMs).toBe(Date.UTC(2026, 10, 20, 0, 15));
  });

  it.each([
    [Date.UTC(2026, 2, 8, 4), Date.UTC(2026, 2, 8, 10)],
    [Date.UTC(2026, 10, 1, 3), Date.UTC(2026, 10, 1, 11)],
  ] as const)('finds the local dawn when the offset changes during the night of %s', (now, next) => {
    expect(readWarehouseYardLightTime(now, 'America/New_York')).toEqual({
      isNight: true,
      nextBoundaryMs: next,
    });
  });

  it('uses UTC when a saved warehouse lacks a usable timezone', () => {
    const instant = Date.UTC(2026, 10, 19, 13);

    expect(readWarehouseYardLightTime(instant, '')).toEqual(readWarehouseYardLightTime(instant, 'UTC'));
  });
});

describe('warehouse daylight scheduling', () => {
  it('schedules precision at an accelerated boundary and caps browser timeouts', () => {
    expect(readWarehouseYardLightDelay(3_600, 1_000, 60)).toBe(44);
    expect(readWarehouseYardLightDelay(43_200_000, 0, 0.001)).toBe(2_147_483_647);
  });

  it('stops while simulation time is paused and avoids polling a delayed boundary in a tight loop', () => {
    expect(readWarehouseYardLightDelay(3_600, 1_000, 0)).toBeUndefined();
    expect(readWarehouseYardLightDelay(1_000, 1_000, 1)).toBe(250);
  });
});
