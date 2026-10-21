import { Vector3 } from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  computeGlowIntensity,
  QUALITY_LEVEL_SETTINGS,
  WORLD_GLOW_RAMP,
} from '@/shared/3d';

import type { StreetLampsValue } from './buildStreetLamps';

import {
  buildStreetLamps,
  getLampRank,
} from './buildStreetLamps';
import {
  buildSampleLayout,
  createCity,
  createRoad,
} from './nightTestSupport';

const EPSILON = 1e-5;
const FORBIDDEN_METERS = 8.4;

const buildStraight = (length: number): StreetLampsValue => {
  const from = createCity('from', 0, 0);
  const to = createCity('to', length, 0);

  return buildStreetLamps([createRoad('road', from, to)], [from, to]);
};

const sortedByPlace = (lamps: StreetLampsValue): StreetLampsValue['lamps'] =>
  lamps.lamps.toSorted((current, prev) => current.postX - prev.postX);

const readPosition = (matrices: Float32Array, index: number): Vector3 => new Vector3(
  matrices[index * 16 + 12],
  matrices[index * 16 + 13],
  matrices[index * 16 + 14],
);

describe('buildStreetLamps', () => {
  it('counts the lamps of a road by the working length: none under 3 m, round(U / 6) otherwise', () => {
    expect(buildStraight(17).count).toBe(0);
    expect(buildStraight(19.5).count).toBe(0);
    expect(buildStraight(19.8).count).toBe(1);
    expect(buildStraight(36).count).toBe(3);
    expect(buildStraight(50).count).toBe(6);
  });

  it('spaces the lamps evenly from 4.5 to 7.5 m and puts them on alternating sides at 1.35 m from the axis', () => {
    const lamps = sortedByPlace(buildStraight(100));
    const workLength = 100 - 2 * FORBIDDEN_METERS;
    const step = workLength / Math.round(workLength / 6);

    expect(lamps).toHaveLength(14);
    expect(step).toBeGreaterThan(4.5);
    expect(step).toBeLessThan(7.5);
    expect(lamps[0]?.postX).toBeCloseTo(FORBIDDEN_METERS + step / 2, 6);

    for (const [index, lamp] of lamps.entries()) {
      const prev = lamps[index - 1];

      expect(Math.abs(lamp.postZ)).toBeCloseTo(1.35, 6);
      expect(Math.abs(lamp.poolZ)).toBeCloseTo(0.4, 6);
      expect(Math.sign(lamp.poolZ)).toBe(Math.sign(lamp.postZ));
      expect(lamp.poolX).toBeCloseTo(lamp.postX, 6);

      if (prev !== undefined) {
        expect(lamp.postX - prev.postX).toBeCloseTo(step, 6);
        expect(Math.sign(lamp.postZ)).toBe(-Math.sign(prev.postZ));
      }
    }
  });

  it('puts the posts on one side of a road in any direction', () => {
    const from = createCity('from', 10, 10);
    const to = createCity('to', 10, 90);
    const lamps = buildStreetLamps([createRoad('road', from, to)], [from, to]).lamps;

    expect(lamps.length).toBeGreaterThan(5);

    for (const lamp of lamps) {
      expect(Math.abs(Math.abs(lamp.postX - 10) - 1.35)).toBeLessThan(EPSILON);
      expect(lamp.postZ).toBeGreaterThan(10 + FORBIDDEN_METERS);
      expect(lamp.postZ).toBeLessThan(90 - FORBIDDEN_METERS);
    }
  });

  it('never puts a lamp closer than the clearing to any city, including the cities the road passes by', () => {
    const from = createCity('from', 0, 0);
    const to = createCity('to', 100, 0);
    const near = createCity('near', 50, 6);
    const lamps = buildStreetLamps([createRoad('road', from, to)], [from, to, near]);

    expect(lamps.count).toBeGreaterThan(8);
    expect(lamps.count).toBeLessThan(14);

    for (const lamp of lamps.lamps) {
      expect(Math.hypot(lamp.postX - near.x, lamp.postZ - near.z)).toBeGreaterThanOrEqual(FORBIDDEN_METERS);
      expect(Math.hypot(lamp.poolX - near.x, lamp.poolZ - near.z)).toBeGreaterThan(near.radius + 1.5);
    }
  });

  it('keeps every lamp of a real layout out of the clearings of all cities and gives close cities no lamps', () => {
    const { cities, roads } = buildSampleLayout();
    const lamps = buildStreetLamps(roads, cities);

    expect(lamps.count).toBeGreaterThan(20);

    for (const lamp of lamps.lamps) {
      for (const city of cities) {
        expect(Math.hypot(lamp.postX - city.x, lamp.postZ - city.z)).toBeGreaterThanOrEqual(city.radius + 2 - EPSILON);
      }
    }
  });

  it('does not fail on no roads, a zero length road and a road to an unknown city', () => {
    const only = createCity('only', 5, 5);
    const ghost = createCity('ghost', 80, 5);

    expect(buildStreetLamps([], []).count).toBe(0);
    expect(buildStreetLamps([], []).getVisibleCount(1)).toBe(0);
    expect(buildStreetLamps([createRoad('loop', only, only)], [only]).count).toBe(0);
    expect(buildStreetLamps([createRoad('lost', only, ghost)], [only]).count).toBeGreaterThan(0);
  });

  it('keeps the lamps sorted by rank so that the density cuts the tail', () => {
    const lamps = buildStraight(700);
    const ranks = lamps.lamps.map(lamp => lamp.rank);

    expect(ranks).toEqual(ranks.toSorted((current, prev) => current - prev));
    expect(ranks.every(rank => rank >= 0 && rank < 1)).toBe(true);
    expect(getLampRank(0)).toBeCloseTo(0.5, 6);
    expect(getLampRank(1)).toBeCloseTo(0.118034, 6);

    for (const density of [0.3, 0.6, 1]) {
      expect(lamps.getVisibleCount(density)).toBe(ranks.filter(rank => rank < density).length);
    }
  });

  it('shows about the density share of the lamps on every level, spread out without clumps', () => {
    const lamps = buildStraight(700);
    const byPlace = sortedByPlace(lamps);

    for (const level of ['low', 'medium', 'high'] as const) {
      const { decorDensity } = QUALITY_LEVEL_SETTINGS[level];
      const share = lamps.getVisibleCount(decorDensity) / lamps.count;

      expect(Math.abs(share - decorDensity)).toBeLessThan(level === 'high' ? EPSILON : 0.05);
    }

    const visiblePlaces = byPlace.filter(lamp => lamp.rank < 0.3).map(lamp => lamp.postX);
    const gaps = visiblePlaces.slice(1).map((place, index) => place - (visiblePlaces[index] ?? 0));
    const meanGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const hiddenRun = byPlace.reduce(
      (state, lamp) => {
        const run = lamp.rank < 0.3 ? 0 : state.run + 1;

        return { max: Math.max(state.max, run), run };
      },
      { max: 0, run: 0 },
    ).max;

    expect(meanGap).toBeGreaterThan(15);
    expect(meanGap).toBeLessThan(25);
    expect(Math.min(...gaps)).toBeGreaterThan(10);
    expect(Math.max(...gaps)).toBeLessThan(45);
    expect(hiddenRun).toBeLessThanOrEqual(6);
  });

  it('nests the visible sets of the levels and keeps each lamp on its place when the level changes', () => {
    const { cities, roads } = buildSampleLayout();
    const lamps = buildStreetLamps(roads, cities);
    const [low, medium, high] = [0.3, 0.6, 1].map(density => lamps.getVisibleCount(density));
    const keyOf = (lamp: StreetLampsValue['lamps'][number]): string => [lamp.roadId, lamp.index].join(':');
    const keysOf = (count: number): Set<string> => new Set(lamps.lamps.slice(0, count).map(keyOf));

    expect(low).toBeGreaterThan(0);
    expect(low).toBeLessThan(medium ?? 0);
    expect(medium).toBeLessThan(high ?? 0);
    expect(high).toBe(lamps.count);

    for (const key of keysOf(low ?? 0)) {
      expect(keysOf(medium ?? 0).has(key)).toBe(true);
    }

    expect(keysOf(lamps.count).size).toBe(lamps.count);
  });

  it('gives the same result for the same input', () => {
    const { cities, roads } = buildSampleLayout();
    const first = buildStreetLamps(roads, cities);
    const second = buildStreetLamps(roads, cities);

    expect(second.lamps).toEqual(first.lamps);
    expect(second.poleMatrices).toEqual(first.poleMatrices);
    expect(second.delays).toEqual(first.delays);
  });

  it('writes the matrices of pole, head, pool and halo on the place of each lamp', () => {
    const lamps = buildStraight(100);

    expect(lamps.poleMatrices).toHaveLength(lamps.count * 16);
    expect(lamps.headMatrices).toHaveLength(lamps.count * 16);
    expect(lamps.poolMatrices).toHaveLength(lamps.count * 16);
    expect(lamps.haloMatrices).toHaveLength(lamps.count * 16);
    expect(lamps.delays).toHaveLength(lamps.count);

    for (const [index, lamp] of lamps.lamps.entries()) {
      const pole = readPosition(lamps.poleMatrices, index);
      const head = readPosition(lamps.headMatrices, index);
      const pool = readPosition(lamps.poolMatrices, index);
      const halo = readPosition(lamps.haloMatrices, index);

      expect([pole.x, pole.y, pole.z]).toEqual([expect.closeTo(lamp.postX, 5), 0, expect.closeTo(lamp.postZ, 5)]);
      expect([head.x, head.y, head.z]).toEqual([expect.closeTo(lamp.postX, 5), expect.closeTo(1.5, 5), expect.closeTo(lamp.postZ, 5)]);
      expect([pool.x, pool.y, pool.z]).toEqual([expect.closeTo(lamp.poolX, 5), expect.closeTo(0.07, 5), expect.closeTo(lamp.poolZ, 5)]);
      expect([halo.x, halo.y, halo.z]).toEqual([expect.closeTo(lamp.postX, 5), expect.closeTo(1.58, 5), expect.closeTo(lamp.postZ, 5)]);
      expect(lamps.poleMatrices[index * 16 + 5]).toBeCloseTo(1.5, 5);
      expect(lamps.headMatrices[index * 16 + 5]).toBeCloseTo(0.16, 5);
    }
  });

  it('turns the lamps on in the wave window, earlier far from the center, in at least three groups', () => {
    const { cities, roads } = buildSampleLayout();
    const lamps = buildStreetLamps(roads, cities);
    const groups = new Set([...lamps.delays].map(delay => Math.floor(delay / 0.03)));

    expect(Math.min(...lamps.delays)).toBeGreaterThanOrEqual(0.35 - EPSILON);
    expect(Math.max(...lamps.delays) + WORLD_GLOW_RAMP).toBeLessThanOrEqual(0.95);
    expect(groups.size).toBeGreaterThanOrEqual(3);

    for (const delay of lamps.delays) {
      expect(computeGlowIntensity(0.35, delay)).toBe(0);
      expect(computeGlowIntensity(0.7, delay)).toBeCloseTo(1, 6);
    }

    const order = lamps.lamps.map((lamp, index) => ({ delay: lamps.delays[index] ?? 0, distance: Math.hypot(lamp.postX, lamp.postZ) }))
      .toSorted((current, prev) => current.distance - prev.distance);
    const half = Math.floor(order.length / 2);
    const meanDelay = (entries: typeof order): number => entries.reduce((sum, entry) => sum + entry.delay, 0) / entries.length;

    expect(meanDelay(order.slice(0, half))).toBeLessThan(meanDelay(order.slice(half)));
  });
});
