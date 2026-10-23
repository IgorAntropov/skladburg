import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  NetworkMapCityValue,
  NetworkMapModelValue,
  NetworkMapRoadValue,
} from '@/entities/network';

import { projectMiniMap } from './projectMiniMap';

const createCity = (id: string, column: number, row: number): NetworkMapCityValue => ({
  cityId: `${id}-city`,
  id,
  name: id,
  position: { column, row },
  siteIds: [],
  tier: 'medium',
  timeZone: 'Europe/Moscow',
});

const createRoad = (id: string, fromNodeId: string, toNodeId: string): NetworkMapRoadValue => ({
  distanceKm: 100,
  driveMinutes: 80,
  fromNodeId,
  id,
  toNodeId,
});

const createModel = (
  cities: readonly NetworkMapCityValue[],
  roads: readonly NetworkMapRoadValue[] = [],
): NetworkMapModelValue => ({ cities, roads, sites: [] });

describe('projectMiniMap', () => {
  it('puts a single city in the center', () => {
    const projection = projectMiniMap(createModel([createCity('a', 4, 7)]), 0.1);

    expect(projection.cities).toEqual([{ id: 'a', x: 0.5, y: 0.5 }]);
    expect(projection.aspectRatio).toBe(1);
  });

  it('returns an empty projection for an empty model', () => {
    expect(projectMiniMap(createModel([]), 0.1)).toEqual({ aspectRatio: 1, cities: [], roads: [] });
  });

  it('keeps the grid proportions and the same padding on every side', () => {
    const projection = projectMiniMap(
      createModel([createCity('a', 2, 3), createCity('b', 6, 5), createCity('c', 4, 4)]),
      0.125,
    );
    const [a, b, c] = projection.cities;

    expect(projection.aspectRatio).toBeCloseTo(5 / 3, 10);
    expect(a?.x).toBeCloseTo(0.5 / 5, 10);
    expect(a?.y).toBeCloseTo(0.5 / 3, 10);
    expect(b?.x).toBeCloseTo(4.5 / 5, 10);
    expect(b?.y).toBeCloseTo(2.5 / 3, 10);
    expect(c?.x).toBeCloseTo(0.5, 10);
    expect(c?.y).toBeCloseTo(0.5, 10);
  });

  it('scales both axes by the same factor', () => {
    const projection = projectMiniMap(createModel([createCity('a', 0, 0), createCity('b', 4, 2)]), 0.1);
    const [a, b] = projection.cities;
    const horizontalDistance = ((b?.x ?? 0) - (a?.x ?? 0)) * projection.aspectRatio;
    const verticalDistance = (b?.y ?? 0) - (a?.y ?? 0);

    expect(horizontalDistance / verticalDistance).toBeCloseTo(2, 10);
  });

  it('centers cities placed on one line', () => {
    const projection = projectMiniMap(createModel([createCity('a', 1, 2), createCity('b', 5, 2)]), 0.1);

    expect(projection.cities.map(point => point.y)).toEqual([0.5, 0.5]);
    expect(projection.cities[0]?.x).toBeLessThan(0.5);
    expect(projection.cities[1]?.x).toBeGreaterThan(0.5);
  });

  it('keeps every point inside the unit square', () => {
    const projection = projectMiniMap(
      createModel([createCity('a', 0, 0), createCity('b', 8, 1), createCity('c', 3, 6)]),
      0.05,
    );

    for (const point of projection.cities) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
  });

  it('builds roads from the city points by node id', () => {
    const projection = projectMiniMap(
      createModel([createCity('a', 0, 0), createCity('b', 2, 2)], [createRoad('road-1', 'a', 'b')]),
      0.1,
    );

    expect(projection.roads).toEqual([{ from: projection.cities[0], id: 'road-1', to: projection.cities[1] }]);
  });

  it('skips a road with an unknown end', () => {
    const projection = projectMiniMap(
      createModel(
        [createCity('a', 0, 0), createCity('b', 2, 2)],
        [createRoad('road-1', 'a', 'missing'), createRoad('road-2', 'missing', 'b'), createRoad('road-3', 'b', 'a')],
      ),
      0.1,
    );

    expect(projection.roads.map(road => road.id)).toEqual(['road-3']);
  });
});
