import {
  Matrix4,
  Vector3,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  computeGlowIntensity,
  WORLD_GLOW_RAMP,
} from '@/shared/3d';

import type { NetworkSceneBuildingValue } from '../layout';
import type { ModelWindowSourceValue } from '../mix/createModelWindowSources';
import type { WindowInstancesValue } from './buildWindowInstances';

import { buildWindowInstances } from './buildWindowInstances';
import {
  DARK_WINDOW_DELAY,
  WINDOW_DELAY_RANGE,
} from './nightConstants';
import {
  buildSampleLayout,
  createBuilding,
  createCity,
  createGlassWindows,
  createModelSource,
} from './nightTestSupport';

const CITY = createCity('city', 10, -6);
const CORNER_MARGIN = 0.2;
const STANDOFF = 0.02;
const EPSILON = 1e-5;

const WAREHOUSE = createBuilding({
  depth: 1.5,
  height: 1.5,
  id: 'warehouse',
  isCompany: true,
  kind: 'warehouse',
  rank: 0,
  width: 2,
});

const countWindows = (building: NetworkSceneBuildingValue): number => buildWindowInstances([building], [CITY]).count;

const readMatrix = (windows: WindowInstancesValue, index: number): Matrix4 => new Matrix4().fromArray(windows.matrices, index * 16);

describe('buildWindowInstances', () => {
  it('counts the windows by the kind of the building and the width of its walls', () => {
    expect(countWindows(createBuilding({ depth: 1, kind: 'house', width: 1.1 }))).toBe(4);
    expect(countWindows(createBuilding({ depth: 1.2, kind: 'house', width: 1.5 }))).toBe(6);
    expect(countWindows(createBuilding({ depth: 1.2, height: 1.8, kind: 'office', width: 1.2 }))).toBe(8);
    expect(countWindows(createBuilding({ depth: 1.2, height: 1.8, kind: 'office', width: 1.5 }))).toBe(12);
    expect(countWindows(createBuilding({ depth: 1.6, height: 1.8, kind: 'office', width: 1.6 }))).toBe(16);
    expect(countWindows(WAREHOUSE)).toBe(10);
  });

  it('puts every window on a wall of a turned building, facing out, no farther than the standoff and clear of the corners', () => {
    const turned: NetworkSceneBuildingValue[] = [
      createBuilding({ depth: 1.2, id: 'house', kind: 'house', rotation: 0.7, width: 1.6 }),
      createBuilding({ depth: 1.4, height: 1.9, id: 'office', kind: 'office', rotation: -2.1, width: 1.5, x: 3, z: 4 }),
      { ...WAREHOUSE, rotation: 1.3, x: -5, z: 8 },
    ];

    for (const building of turned) {
      const windows = buildWindowInstances([building], [CITY]);
      const wallHeight = building.kind === 'office' ? building.height - 0.1 : building.height - 0.5;
      const cosine = Math.cos(building.rotation);
      const sine = Math.sin(building.rotation);

      expect(windows.count).toBeGreaterThan(0);

      for (let index = 0; index < windows.count; index += 1) {
        const matrix = readMatrix(windows, index);
        const position = new Vector3().setFromMatrixPosition(matrix);
        const scale = new Vector3().setFromMatrixScale(matrix);
        const normal = new Vector3(0, 0, 1).transformDirection(matrix);
        const localX = (position.x - building.x) * cosine - (position.z - building.z) * sine;
        const localZ = (position.x - building.x) * sine + (position.z - building.z) * cosine;
        const localNormalX = normal.x * cosine - normal.z * sine;
        const localNormalZ = normal.x * sine + normal.z * cosine;
        const isOnDepthWall = Math.abs(Math.abs(localZ) - (building.depth / 2 + STANDOFF)) < EPSILON;
        const isOnWidthWall = Math.abs(Math.abs(localX) - (building.width / 2 + STANDOFF)) < EPSILON;

        expect(isOnDepthWall !== isOnWidthWall).toBe(true);

        if (isOnDepthWall) {
          expect(localNormalZ).toBeCloseTo(Math.sign(localZ), 5);
          expect(Math.abs(localX) + scale.x / 2).toBeLessThanOrEqual(building.width / 2 - CORNER_MARGIN + EPSILON);
        }
        else {
          expect(localNormalX).toBeCloseTo(Math.sign(localX), 5);
          expect(Math.abs(localZ) + scale.x / 2).toBeLessThanOrEqual(building.depth / 2 - CORNER_MARGIN + EPSILON);
        }

        expect(position.y - scale.y / 2).toBeGreaterThanOrEqual(0.1 - EPSILON);
        expect(position.y + scale.y / 2).toBeLessThanOrEqual(0.1 + wallHeight + EPSILON);
      }
    }
  });

  it('puts the windows at the heights of the spec', () => {
    const house = buildWindowInstances([createBuilding({ height: 1.5, kind: 'house' })], [CITY]);
    const office = buildWindowInstances([createBuilding({ height: 1.9, kind: 'office' })], [CITY]);
    const warehouse = buildWindowInstances([WAREHOUSE], [CITY]);
    const readHeight = (windows: WindowInstancesValue, index: number): number =>
      Number(new Vector3().setFromMatrixPosition(readMatrix(windows, index)).y.toFixed(4));
    const readHeights = (windows: WindowInstancesValue): number[] => [...new Set(
      Array.from({ length: windows.count }, (_, index) => readHeight(windows, index)),
    )].toSorted((current, prev) => current - prev);

    expect(readHeights(house)).toEqual([0.1 + 0.5 * 1]);
    expect(readHeights(office)).toEqual([0.1 + 0.32 * 1.8, 0.1 + 0.7 * 1.8].map(height => Number(height.toFixed(4))));
    expect(readHeights(warehouse)).toEqual([0.1 + 0.65]);
  });

  it('keeps the windows of a building together and orders the buildings companies first, decor by rank', () => {
    const buildings = [
      createBuilding({ id: 'decor-late', rank: 0.8 }),
      createBuilding({ id: 'decor-early', rank: 0.1 }),
      { ...WAREHOUSE, id: 'company' },
    ];
    const windows = buildWindowInstances(buildings, [CITY]);

    expect(windows.buildings.map(building => building.id)).toEqual(['company', 'decor-early', 'decor-late']);
    expect([...windows.windowEnds]).toEqual([10, 16, 22]);
    expect(windows.count).toBe(22);
    expect(windows.matrices).toHaveLength(22 * 16);
    expect(windows.delays).toHaveLength(22);
  });

  it('cuts the tail by density so that every company keeps its windows and only visible decor has them', () => {
    const buildings = [
      { ...WAREHOUSE, id: 'company-a' },
      { ...WAREHOUSE, id: 'company-b', rank: 0.9 },
      createBuilding({ id: 'decor-1', rank: 0.1 }),
      createBuilding({ id: 'decor-2', rank: 0.25 }),
      createBuilding({ id: 'decor-3', rank: 0.5 }),
      createBuilding({ id: 'decor-4', rank: 0.95 }),
    ];
    const windows = buildWindowInstances(buildings, [CITY]);
    const low = windows.getVisibleCount(0.3);
    const medium = windows.getVisibleCount(0.6);

    expect(low).toBe(10 + 10 + 6 + 6);
    expect(medium).toBe(low + 6);
    expect(windows.getVisibleCount(1)).toBe(windows.count);
    expect(windows.getVisibleCount(0)).toBe(20);
    expect(buildWindowInstances([createBuilding({ rank: 0.5 })], [CITY]).getVisibleCount(0.3)).toBe(0);
  });

  it('gives the same result for the same input however the buildings come', () => {
    const { buildings, cities } = buildSampleLayout();
    const forward = buildWindowInstances(buildings, cities);
    const again = buildWindowInstances(buildings, cities);
    const reversed = buildWindowInstances(buildings.toReversed(), cities);

    expect(again.matrices).toEqual(forward.matrices);
    expect(again.delays).toEqual(forward.delays);
    expect(reversed.count).toBe(forward.count);
    expect(reversed.delays).toEqual(forward.delays);
  });

  it('keeps about a quarter of the windows dark all night and times the rest inside the wave window', () => {
    const { buildings, cities } = buildSampleLayout();
    const windows = buildWindowInstances(buildings, cities);
    const lit = [...windows.delays].filter(delay => delay < 1);
    const darkShare = 1 - lit.length / windows.count;

    expect(windows.count).toBeGreaterThan(150);
    expect(darkShare).toBeGreaterThan(0.18);
    expect(darkShare).toBeLessThan(0.32);
    expect(Math.min(...lit)).toBeGreaterThanOrEqual(0.45 - EPSILON);
    expect(Math.max(...lit) + WORLD_GLOW_RAMP).toBeLessThanOrEqual(0.95 + EPSILON);
    expect(windows.delays.filter(delay => delay >= 1).every(delay => delay === 1)).toBe(true);
  });

  it('lights every lit window at the top of the wave window and none at the bottom', () => {
    const { buildings, cities } = buildSampleLayout();
    const { delays } = buildWindowInstances(buildings, cities);

    for (const delay of delays) {
      expect(computeGlowIntensity(0.45, delay)).toBe(0);

      if (delay < 1) {
        expect(computeGlowIntensity(0.95, delay)).toBeCloseTo(1, 6);
      }
      else {
        expect(computeGlowIntensity(1, delay)).toBe(0);
      }
    }
  });

  it('spreads the lit windows over at least three distinguishable groups', () => {
    const { buildings, cities } = buildSampleLayout();
    const { delays } = buildWindowInstances(buildings, cities);
    const groups = new Set([...delays].filter(delay => delay < 1).map(delay => Math.floor(delay / 0.04)));

    expect(groups.size).toBeGreaterThanOrEqual(3);
  });

  it('lights the cities nearer to the map center first and each city from its middle to its edge', () => {
    const { buildings, cities } = buildSampleLayout();
    const windows = buildWindowInstances(buildings, cities);
    const cityById = new Map(cities.map(city => [city.id, city]));
    const owners = windows.buildings.flatMap((building, index) => {
      const start = index === 0 ? 0 : (windows.windowEnds[index - 1] ?? 0);
      const end = windows.windowEnds[index] ?? 0;

      return Array.from({ length: end - start }, (_, offset) => ({ building, delay: windows.delays[start + offset] ?? 1 }));
    }).filter(entry => entry.delay < 1);
    const meanDelay = (entries: typeof owners): number => entries.reduce((sum, entry) => sum + entry.delay, 0) / entries.length;
    const byDistance = cities.toSorted((current, prev) => Math.hypot(current.x, current.z) - Math.hypot(prev.x, prev.z));
    const nearest = byDistance[0];
    const farthest = byDistance.at(-1);

    expect(nearest).toBeDefined();
    expect(farthest).toBeDefined();
    expect(meanDelay(owners.filter(entry => entry.building.cityId === nearest?.id)))
      .toBeLessThan(meanDelay(owners.filter(entry => entry.building.cityId === farthest?.id)));

    const distanceToCity = (entry: (typeof owners)[number]): number => {
      const city = cityById.get(entry.building.cityId);

      return Math.hypot(entry.building.x - (city?.x ?? 0), entry.building.z - (city?.z ?? 0));
    };
    const sortedByDistance = owners.toSorted((current, prev) => distanceToCity(current) - distanceToCity(prev));
    const half = Math.floor(sortedByDistance.length / 2);

    expect(meanDelay(sortedByDistance.slice(0, half))).toBeLessThan(meanDelay(sortedByDistance.slice(half)));
  });

  it('survives buildings of an unknown city', () => {
    const windows = buildWindowInstances([createBuilding({ cityId: 'ghost' })], []);

    expect(windows.count).toBe(6);
    expect(windows.delays.every(delay => delay >= 0.45 - EPSILON && delay <= 1)).toBe(true);
  });

  describe('with the windows of models', () => {
    const MODEL_BUILDING = createBuilding({ depth: 1, height: 1.5, id: 'model', width: 2, x: 12, z: -4 });
    const ALL_FACES = (['positiveZ', 'positiveX', 'negativeZ', 'negativeX'] as const).map(face => ({ doorClearance: 0, face, inset: 0 }));
    const HOUSE_WALLS = { faces: ALL_FACES, heightShare: 0.9 };

    const buildFor = (
      source: ModelWindowSourceValue,
      building: NetworkSceneBuildingValue = MODEL_BUILDING,
    ): WindowInstancesValue => buildWindowInstances([building], [CITY], new Map([[building.id, source]]));

    it('gives a model the windows of its glass and nothing else when the catalog has no walls for it', () => {
      const windows = buildFor(createModelSource({ glass: createGlassWindows(7) }));

      expect(windows.count).toBe(7);
      expect(buildFor(createModelSource()).count).toBe(0);
    });

    it('adds the windows of the walls of the catalog after the glass, by the rules of the house', () => {
      const windows = buildFor(createModelSource({ glass: createGlassWindows(3), walls: HOUSE_WALLS }));

      expect(windows.count).toBe(3 + 2 + 2 + 1 + 1);
    });

    it('keeps the windows of the walls under the height of the wall of the fitted model', () => {
      const source = createModelSource({ walls: HOUSE_WALLS });
      const windows = buildFor(source);
      const wallHeight = 1 * 1.5 * 0.9;

      expect(windows.count).toBeGreaterThan(0);

      for (let index = 0; index < windows.count; index += 1) {
        const matrix = readMatrix(windows, index);
        const position = new Vector3().setFromMatrixPosition(matrix);
        const scale = new Vector3().setFromMatrixScale(matrix);

        expect(position.y - scale.y / 2).toBeGreaterThanOrEqual(0.1 - EPSILON);
        expect(position.y + scale.y / 2).toBeLessThanOrEqual(0.1 + wallHeight + EPSILON);
      }
    });

    it('leaves no windows on a wall where a door clears the slots and on the walls the catalog does not list', () => {
      const building = createBuilding({ depth: 0.91, height: 0.8, id: 'warehouse-model', kind: 'warehouse', width: 1.3 });
      const bounds = { max: [0.65, 0.77, 0.455], min: [-0.65, 0, -0.455] } as const;
      const createWalls = (clearance: number): ModelWindowSourceValue['walls'] => ({
        faces: [{ doorClearance: 0, face: 'positiveX', inset: 0.05 }, { doorClearance: clearance, face: 'positiveZ', inset: 0.05 }],
        heightShare: 0.5,
      });

      expect(buildFor(createModelSource({ bounds, group: 'warehouse', walls: createWalls(0.1) }), building).count).toBe(4);
      expect(buildFor(createModelSource({ bounds, group: 'warehouse', walls: createWalls(0.2) }), building).count).toBe(2);
    });

    it('keeps a warehouse window below the eave however low the wall of the fitted model is', () => {
      const building = createBuilding({ depth: 0.91, height: 1.2, id: 'warehouse-model', kind: 'warehouse', width: 1.3 });
      const bounds = { max: [0.65, 0.77, 0.455], min: [-0.65, 0, -0.455] } as const;
      const walls = { faces: [{ doorClearance: 0, face: 'positiveX', inset: 0.05 }], heightShare: 0.5 } as const;
      const windows = buildFor(createModelSource({ bounds, group: 'warehouse', walls }), building);
      const wallHeight = 0.77 * (1.2 / 0.77) * 0.5;

      expect(windows.count).toBe(2);

      for (let index = 0; index < windows.count; index += 1) {
        const matrix = readMatrix(windows, index);
        const top = new Vector3().setFromMatrixPosition(matrix).y + new Vector3().setFromMatrixScale(matrix).y / 2;

        expect(top).toBeLessThanOrEqual(0.1 + wallHeight + EPSILON);
      }
    });

    it('keeps about a quarter of the windows of models dark and times the rest inside the wave window', () => {
      const buildings = Array.from({ length: 300 }, (_, index) => createBuilding({ id: `model-${String(index)}`, rank: index / 300 }));
      const source = createModelSource({ glass: createGlassWindows(12) });
      const windows = buildWindowInstances(buildings, [CITY], new Map(buildings.map(building => [building.id, source])));
      const lit = [...windows.delays].filter(delay => delay < DARK_WINDOW_DELAY);

      expect(windows.count).toBe(3600);
      expect(1 - lit.length / windows.count).toBeGreaterThan(0.22);
      expect(1 - lit.length / windows.count).toBeLessThan(0.28);
      expect(Math.min(...lit)).toBeGreaterThanOrEqual(WINDOW_DELAY_RANGE[0] - EPSILON);
      expect(Math.max(...lit)).toBeLessThanOrEqual(WINDOW_DELAY_RANGE[1] + EPSILON);
      expect(windows.delays.filter(delay => delay >= DARK_WINDOW_DELAY).every(delay => delay === DARK_WINDOW_DELAY)).toBe(true);
    });

    it('gives the same windows however the buildings come and the same keys as the first call', () => {
      const buildings = ['a', 'b', 'c', 'd', 'e'].map((id, index) => createBuilding({ id, rank: index / 5, x: 10 + index }));
      const source = createModelSource({ glass: createGlassWindows(6), walls: HOUSE_WALLS });
      const sources = new Map(buildings.map(building => [building.id, source]));
      const forward = buildWindowInstances(buildings, [CITY], sources);
      const reversed = buildWindowInstances(buildings.toReversed(), [CITY], sources);

      expect(reversed.matrices).toEqual(forward.matrices);
      expect(reversed.delays).toEqual(forward.delays);
      expect(reversed.windowEnds).toEqual(forward.windowEnds);
    });

    it('cuts the tail by density in whole buildings and leaves boxes as they are without a source', () => {
      const buildings = [
        { ...WAREHOUSE, id: 'company' },
        createBuilding({ id: 'decor-model-1', rank: 0.1 }),
        createBuilding({ id: 'decor-box', rank: 0.25 }),
        createBuilding({ id: 'decor-model-2', rank: 0.95 }),
      ];
      const source = createModelSource({ glass: createGlassWindows(5) });
      const sources = new Map([['decor-model-1', source], ['decor-model-2', source]]);
      const windows = buildWindowInstances(buildings, [CITY], sources);

      expect(windows.windowEnds[0]).toBe(10);
      expect(windows.getVisibleCount(0.3)).toBe(10 + 5 + 6);
      expect(windows.getVisibleCount(1)).toBe(10 + 5 + 6 + 5);
      expect(windows.getVisibleCount(0)).toBe(10);
      expect(buildWindowInstances(buildings.slice(2, 3), [CITY], sources).matrices)
        .toEqual(buildWindowInstances(buildings.slice(2, 3), [CITY]).matrices);
    });
  });
});
