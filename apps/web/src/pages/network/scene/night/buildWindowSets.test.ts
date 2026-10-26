import {
  Matrix4,
  Vector3,
} from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkSceneBuildingValue } from '../layout';
import type {
  ModelWindowSourcesValue,
  ModelWindowSourceValue,
} from '../mix/createModelWindowSources';
import type { WindowInstancesValue } from './buildWindowInstances';

import { PLAZA_HEIGHT_METERS } from '../geometry/networkSceneMetrics';
import {
  buildWindowInstances,
  buildWindowSets,
} from './buildWindowInstances';
import {
  DARK_WINDOW_DELAY,
  FAR_WINDOW_SCALE,
  WINDOW_DELAY_RANGE,
  WINDOW_STANDOFF_METERS,
} from './nightConstants';
import {
  buildSampleLayout,
  createBuilding,
  createCity,
  createGlassWindows,
  createModelSource,
} from './nightTestSupport';

const CITY = createCity('city', 10, -6);
const EPSILON = 1e-5;
const HOUSE_SLOT_WIDTH = 0.36;
const HOUSE_SLOT_HEIGHT = 0.4;
const ALL_FACES = (['positiveZ', 'positiveX', 'negativeZ', 'negativeX'] as const).map(face => ({ doorClearance: 0, face, inset: 0 }));
const HOUSE_WALLS = { faces: ALL_FACES, heightShare: 0.9 };

const WAREHOUSE = createBuilding({
  depth: 1.5,
  height: 1.5,
  id: 'warehouse',
  isCompany: true,
  kind: 'warehouse',
  rank: 0,
  width: 2,
});

const MODEL_BUILDING = createBuilding({ depth: 1, height: 1.5, id: 'model', width: 2, x: 12, z: -4 });

const readMatrix = (windows: WindowInstancesValue, index: number): Matrix4 => new Matrix4().fromArray(windows.matrices, index * 16);

const readScale = (windows: WindowInstancesValue, index: number): Vector3 => new Vector3().setFromMatrixScale(readMatrix(windows, index));

const readPosition = (windows: WindowInstancesValue, index: number): Vector3 =>
  new Vector3().setFromMatrixPosition(readMatrix(windows, index));

const readNormal = (windows: WindowInstancesValue, index: number): Vector3 =>
  new Vector3(0, 0, 1).transformDirection(readMatrix(windows, index));

const buildFarFor = (
  source: ModelWindowSourceValue,
  building: NetworkSceneBuildingValue = MODEL_BUILDING,
): WindowInstancesValue => buildWindowSets([building], [CITY], new Map([[building.id, source]])).far;

const sliceWindows = (windows: WindowInstancesValue, buildingIndex: number): { delays: number[]; matrices: number[] } => {
  const start = buildingIndex === 0 ? 0 : (windows.windowEnds[buildingIndex - 1] ?? 0);
  const end = windows.windowEnds[buildingIndex] ?? 0;

  return {
    delays: [...windows.delays.slice(start, end)],
    matrices: [...windows.matrices.slice(start * 16, end * 16)],
  };
};

describe('buildWindowSets', () => {
  it('gives the near set exactly as buildWindowInstances builds it from the same input', () => {
    const { buildings, cities } = buildSampleLayout();
    const sources: ModelWindowSourcesValue = new Map(
      buildings.filter((_, index) => index % 3 === 0).map(building => [
        building.id,
        createModelSource({ glass: createGlassWindows(4), walls: HOUSE_WALLS }),
      ]),
    );
    const { near } = buildWindowSets(buildings, cities, sources);
    const single = buildWindowInstances(buildings, cities, sources);

    expect(near.count).toBe(single.count);
    expect(near.matrices).toEqual(single.matrices);
    expect(near.delays).toEqual(single.delays);
    expect(near.windowEnds).toEqual(single.windowEnds);
    expect(near.buildings.map(building => building.id)).toEqual(single.buildings.map(building => building.id));
  });

  it('gives the boxes the same windows, matrices and delays in both sets', () => {
    const { buildings, cities } = buildSampleLayout();
    const { far, near } = buildWindowSets(buildings, cities);

    expect(far.count).toBeGreaterThan(150);
    expect(far.count).toBe(near.count);
    expect(far.matrices).toEqual(near.matrices);
    expect(far.delays).toEqual(near.delays);
    expect(far.windowEnds).toEqual(near.windowEnds);
  });

  it('leaves the boxes next to models as they are in the far set and changes only the models', () => {
    const buildings = [
      { ...WAREHOUSE, id: 'company' },
      createBuilding({ id: 'decor-model', rank: 0.1 }),
      createBuilding({ id: 'decor-box', rank: 0.25 }),
    ];
    const sources = new Map([['decor-model', createModelSource({ farWalls: HOUSE_WALLS, glass: createGlassWindows(5) })]]);
    const { far, near } = buildWindowSets(buildings, [CITY], sources);

    expect(far.buildings.map(building => building.id)).toEqual(['company', 'decor-model', 'decor-box']);
    expect(sliceWindows(far, 0)).toEqual(sliceWindows(near, 0));
    expect(sliceWindows(far, 2)).toEqual(sliceWindows(near, 2));
    expect(sliceWindows(near, 1).delays).toHaveLength(5);
    expect(sliceWindows(far, 1).delays).toHaveLength(6);
  });

  it('gives a model only the windows of its far walls, with no glass', () => {
    const far = buildFarFor(createModelSource({ farWalls: HOUSE_WALLS, glass: createGlassWindows(9) }));
    const withoutGlass = buildFarFor(createModelSource({ farWalls: HOUSE_WALLS }));

    expect(far.count).toBe(2 + 1 + 2 + 1);
    expect(far.matrices).toEqual(withoutGlass.matrices);
    expect(far.delays).toEqual(withoutGlass.delays);
    expect(buildFarFor(createModelSource({ farWalls: { faces: [], heightShare: 0.9 }, glass: createGlassWindows(9) })).count).toBe(0);
  });

  it('scales a far window of a model by the scale of the fit and FAR_WINDOW_SCALE', () => {
    const far = buildFarFor(createModelSource({ farWalls: HOUSE_WALLS }));
    const near = buildWindowSets([MODEL_BUILDING], [CITY], new Map([[MODEL_BUILDING.id, createModelSource({ walls: HOUSE_WALLS })]])).near;
    const scales = Array.from({ length: far.count }, (_, index) => readScale(far, index));
    const nearScales = Array.from({ length: near.count }, (_, index) => readScale(near, index));

    expect(far.count).toBe(near.count);

    for (const [index, scale] of scales.entries()) {
      expect(scale.x).toBeCloseTo((nearScales[index]?.x ?? 0) * FAR_WINDOW_SCALE, 5);
      expect(scale.y).toBeCloseTo((nearScales[index]?.y ?? 0) * FAR_WINDOW_SCALE, 5);
      expect(scale.x).toBeCloseTo(HOUSE_SLOT_WIDTH * FAR_WINDOW_SCALE, 5);
      expect(scale.y).toBeCloseTo(HOUSE_SLOT_HEIGHT * FAR_WINDOW_SCALE, 5);
    }
  });

  it('puts the far windows on the listed faces of a turned model, facing out at the inset plane', () => {
    const building = createBuilding({ depth: 1, height: 1.5, id: 'turned', rotation: 0.7, width: 2, x: 12, z: -4 });
    const walls = {
      faces: [{ doorClearance: 0, face: 'positiveZ', inset: 0.05 }, { doorClearance: 0, face: 'negativeX', inset: 0.1 }],
      heightShare: 0.9,
    } as const;
    const far = buildFarFor(createModelSource({ farWalls: walls }), building);
    const cosine = Math.cos(building.rotation);
    const sine = Math.sin(building.rotation);
    const fitScale = 2;
    const halfDepth = 0.25 * fitScale;
    const halfWidth = 0.5 * fitScale;

    expect(far.count).toBe(2 + 1);

    for (let index = 0; index < far.count; index += 1) {
      const position = readPosition(far, index);
      const normal = readNormal(far, index);
      const localX = (position.x - building.x) * cosine - (position.z - building.z) * sine;
      const localZ = (position.x - building.x) * sine + (position.z - building.z) * cosine;
      const localNormalX = normal.x * cosine - normal.z * sine;
      const localNormalZ = normal.x * sine + normal.z * cosine;
      const isOnFront = Math.abs(localZ - (halfDepth - 0.05 * fitScale + WINDOW_STANDOFF_METERS)) < EPSILON;
      const isOnLeft = Math.abs(localX - (-halfWidth + 0.1 * fitScale - WINDOW_STANDOFF_METERS)) < EPSILON;

      expect(isOnFront !== isOnLeft).toBe(true);
      expect(isOnFront ? localNormalZ : localNormalX).toBeCloseTo(isOnFront ? 1 : -1, 5);
    }
  });

  it('keeps every far window of a model under the share of the wall height and inside the wall length', () => {
    const building = createBuilding({ depth: 1, height: 1.5, id: 'tall', rotation: 0, width: 2, x: 12, z: -4 });
    const far = buildFarFor(createModelSource({ farWalls: { faces: ALL_FACES, heightShare: 0.6 } }), building);
    const wallHeight = 1 * 1.5 * 0.6;

    expect(far.count).toBeGreaterThan(0);

    for (let index = 0; index < far.count; index += 1) {
      const position = readPosition(far, index);
      const scale = readScale(far, index);
      const isOnZWall = Math.abs(readNormal(far, index).z) > 0.5;
      const along = isOnZWall ? position.x - building.x : position.z - building.z;
      const wallLength = isOnZWall ? building.width : building.depth;

      expect(position.y - scale.y / 2).toBeGreaterThanOrEqual(PLAZA_HEIGHT_METERS - EPSILON);
      expect(position.y + scale.y / 2).toBeLessThanOrEqual(PLAZA_HEIGHT_METERS + wallHeight + EPSILON);
      expect(Math.abs(along) + scale.x / 2).toBeLessThanOrEqual(wallLength / 2 + EPSILON);
    }
  });

  it('drops a far window that does not fit under the wall or inside its length instead of moving it', () => {
    const lowWall = buildFarFor(createModelSource({ farWalls: { faces: ALL_FACES, heightShare: 0.2 } }));
    const building = createBuilding({ depth: 0.91, height: 1.2, id: 'warehouse-model', kind: 'warehouse', width: 1.3 });
    const bounds = { max: [0.65, 0.77, 0.455], min: [-0.65, 0, -0.455] } as const;
    const walls = {
      faces: [{ doorClearance: 0, face: 'positiveX', inset: 0.05 }, { doorClearance: 0, face: 'positiveZ', inset: 0.05 }],
      heightShare: 0.5,
    } as const;
    const source = createModelSource({ bounds, farWalls: walls, group: 'warehouse', walls });
    const sets = buildWindowSets([building], [CITY], new Map([[building.id, source]]));

    expect(lowWall.count).toBe(0);
    expect(sets.near.count).toBe(4);
    expect(sets.far.count).toBe(2);
    expect(Math.abs(readNormal(sets.far, 0).z)).toBeCloseTo(1, 5);
    expect(Math.abs(readNormal(sets.far, 1).z)).toBeCloseTo(1, 5);
  });

  it('keeps about a quarter of the far windows of models dark and times the rest inside the wave window', () => {
    const buildings = Array.from({ length: 300 }, (_, index) => createBuilding({ id: `model-${String(index)}`, rank: index / 300 }));
    const source = createModelSource({ farWalls: HOUSE_WALLS });
    const { far } = buildWindowSets(buildings, [CITY], new Map(buildings.map(building => [building.id, source])));
    const lit = [...far.delays].filter(delay => delay < DARK_WINDOW_DELAY);
    const darkShare = 1 - lit.length / far.count;

    expect(far.count).toBe(300 * 6);
    expect(darkShare).toBeGreaterThan(0.22);
    expect(darkShare).toBeLessThan(0.28);
    expect(Math.min(...lit)).toBeGreaterThanOrEqual(WINDOW_DELAY_RANGE[0] - EPSILON);
    expect(Math.max(...lit)).toBeLessThanOrEqual(WINDOW_DELAY_RANGE[1] + EPSILON);
    expect(far.delays.filter(delay => delay >= DARK_WINDOW_DELAY).every(delay => delay === DARK_WINDOW_DELAY)).toBe(true);
  });

  it('gives the same sets for the same input however the buildings come', () => {
    const buildings = ['a', 'b', 'c', 'd', 'e'].map((id, index) => createBuilding({ id, rank: index / 5, x: 10 + index }));
    const source = createModelSource({ farWalls: HOUSE_WALLS, glass: createGlassWindows(6), walls: HOUSE_WALLS });
    const sources = new Map(buildings.map(building => [building.id, source]));
    const forward = buildWindowSets(buildings, [CITY], sources);
    const again = buildWindowSets(buildings, [CITY], sources);
    const reversed = buildWindowSets(buildings.toReversed(), [CITY], sources);

    for (const kind of ['far', 'near'] as const) {
      expect(again[kind].matrices).toEqual(forward[kind].matrices);
      expect(reversed[kind].matrices).toEqual(forward[kind].matrices);
      expect(reversed[kind].delays).toEqual(forward[kind].delays);
      expect(reversed[kind].windowEnds).toEqual(forward[kind].windowEnds);
    }
  });

  it('cuts the tail by density in whole buildings in both sets', () => {
    const buildings = [
      { ...WAREHOUSE, id: 'company' },
      createBuilding({ id: 'decor-model-1', rank: 0.1 }),
      createBuilding({ id: 'decor-box', rank: 0.25 }),
      createBuilding({ id: 'decor-model-2', rank: 0.95 }),
    ];
    const source = createModelSource({ farWalls: HOUSE_WALLS, glass: createGlassWindows(5) });
    const sources = new Map([['decor-model-1', source], ['decor-model-2', source]]);
    const { far, near } = buildWindowSets(buildings, [CITY], sources);

    expect(near.getVisibleCount(0.3)).toBe(10 + 5 + 6);
    expect(far.getVisibleCount(0.3)).toBe(10 + 6 + 6);
    expect(near.getVisibleCount(1)).toBe(10 + 5 + 6 + 5);
    expect(far.getVisibleCount(1)).toBe(10 + 6 + 6 + 6);
    expect(near.getVisibleCount(0)).toBe(10);
    expect(far.getVisibleCount(0)).toBe(10);
  });
});
