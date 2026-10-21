import {
  describe,
  expect,
  it,
} from 'vitest';

import { createSquareWorld } from '@/shared/3d';

import { NETWORK_WORLD_SIZE_METERS } from '../networkWorldConstants';
import {
  MAP_CELL_METERS,
  MAP_EDGE_STRIP_METERS,
  MINI_CITY_RADIUS_METERS,
} from './layoutConstants';
import { projectMapGrid } from './projectMapGrid';

const WORLD = createSquareWorld(NETWORK_WORLD_SIZE_METERS);
const EDGE_METERS = NETWORK_WORLD_SIZE_METERS / 2 - MAP_EDGE_STRIP_METERS - MINI_CITY_RADIUS_METERS;

const createGridCity = (id: string, column: number, row: number): { id: string; position: { column: number; row: number } } => ({
  id,
  position: { column, row },
});

describe('projectMapGrid', () => {
  it('keeps the distance between neighbours equal to the cell', () => {
    const cities = [createGridCity('a', 4, 2), createGridCity('b', 5, 2), createGridCity('c', 4, 3)];
    const { cellMeters, centers } = projectMapGrid(cities, WORLD);
    const a = centers.get('a');
    const b = centers.get('b');
    const c = centers.get('c');

    expect(cellMeters).toBe(MAP_CELL_METERS);
    expect(Math.hypot((b?.x ?? 0) - (a?.x ?? 0), (b?.z ?? 0) - (a?.z ?? 0))).toBeCloseTo(MAP_CELL_METERS, 9);
    expect(Math.hypot((c?.x ?? 0) - (a?.x ?? 0), (c?.z ?? 0) - (a?.z ?? 0))).toBeCloseTo(MAP_CELL_METERS, 9);
  });

  it('grows x with the column and z with the row', () => {
    const { centers } = projectMapGrid([createGridCity('a', 0, 0), createGridCity('b', 3, 0), createGridCity('c', 0, 3)], WORLD);

    expect((centers.get('b')?.x ?? 0) - (centers.get('a')?.x ?? 0)).toBeCloseTo(3 * MAP_CELL_METERS, 9);
    expect(centers.get('b')?.z).toBeCloseTo(centers.get('a')?.z ?? 0, 9);
    expect((centers.get('c')?.z ?? 0) - (centers.get('a')?.z ?? 0)).toBeCloseTo(3 * MAP_CELL_METERS, 9);
    expect(centers.get('c')?.x).toBeCloseTo(centers.get('a')?.x ?? 0, 9);
  });

  it('centers the frame of the grid in the middle of the world', () => {
    const { centers } = projectMapGrid([createGridCity('a', 2, 0), createGridCity('b', 14, 7), createGridCity('c', 6, 2)], WORLD);
    const points = [...centers.values()];

    expect((Math.min(...points.map(point => point.x)) + Math.max(...points.map(point => point.x))) / 2).toBeCloseTo(0, 9);
    expect((Math.min(...points.map(point => point.z)) + Math.max(...points.map(point => point.z))) / 2).toBeCloseTo(0, 9);
  });

  it('puts a single city in the middle of the world', () => {
    const { centers } = projectMapGrid([createGridCity('a', 9, 4)], WORLD);

    expect(centers.get('a')).toEqual({ x: 0, z: 0 });
  });

  it('returns no centers for no cities', () => {
    expect(projectMapGrid([], WORLD).centers.size).toBe(0);
  });

  it('shrinks the cell when the grid is wider than the world strip', () => {
    const { cellMeters, centers } = projectMapGrid([createGridCity('a', 0, 0), createGridCity('b', 30, 4)], WORLD);

    expect(cellMeters).toBeLessThan(MAP_CELL_METERS);
    expect(cellMeters).toBeCloseTo((2 * EDGE_METERS) / 30, 9);

    for (const point of centers.values()) {
      expect(Math.abs(point.x)).toBeLessThanOrEqual(EDGE_METERS + 1e-9);
      expect(Math.abs(point.z)).toBeLessThanOrEqual(EDGE_METERS + 1e-9);
    }
  });

  it('shrinks the cell by the longer axis only', () => {
    const { cellMeters, centers } = projectMapGrid([createGridCity('a', 0, 0), createGridCity('b', 2, 40)], WORLD);

    expect(cellMeters).toBeCloseTo((2 * EDGE_METERS) / 40, 9);
    expect(Math.abs(centers.get('b')?.z ?? 0)).toBeLessThanOrEqual(EDGE_METERS + 1e-9);
  });

  it('does not shrink the cell when the grid just fits', () => {
    const columns = Math.floor((2 * EDGE_METERS) / MAP_CELL_METERS);
    const { cellMeters } = projectMapGrid([createGridCity('a', 0, 0), createGridCity('b', columns, 0)], WORLD);

    expect(cellMeters).toBe(MAP_CELL_METERS);
  });
});
