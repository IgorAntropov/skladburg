import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { WorldModelDataValue } from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import type {
  WorldModelEntryValue,
  WorldModelFaceValue,
  WorldModelWallFaceValue,
} from '../src/pages/network/scene/models/worldModelCatalog.ts';

import { BYTES_PER_KILOBYTE } from '../build-budget/bundleBudgetConstants.ts';
import {
  readWorldModel,
  WORLD_MODEL_ROLES,
} from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import { listWorldModelWindows } from '../src/pages/network/scene/models/listWorldModelWindows.ts';
import {
  buildWorldModelPath,
  COMPANY_WAREHOUSE_MODEL_ID,
  WORLD_MODEL_CATALOG,
} from '../src/pages/network/scene/models/worldModelCatalog.ts';

const appRoot = join(import.meta.dirname, '..');

const modelsRoot = join(appRoot, 'public', 'models');

const BUDGET_KILOBYTES = 300;

const KITS = ['commercial', 'industrial'] as const;

const FOOTPRINT_TOLERANCE = 0.01;

const GLASS_AREA_TOLERANCE = 0.02;

const WALL_PLANE_TOLERANCE = 0.004;

const PLANE_GROUP_STEP = 0.002;

const MAX_FAR_FLOAT = 0.18;

const CENTER_TOLERANCE = 0.01;

const EAVE_TOLERANCE = 0.005;

const GATE_MIN_WIDTH = 0.3;

const GLASS_ROLE = WORLD_MODEL_ROLES.indexOf('glass');

const DARK_ROLE = WORLD_MODEL_ROLES.indexOf('dark');

const ALL_FACES: readonly WorldModelFaceValue[] = ['positiveZ', 'positiveX', 'negativeZ', 'negativeX'];

const FULL_ENTRIES = WORLD_MODEL_CATALOG.filter(({ lod }) => lod === 'full');

const readEntryModel = (entry: WorldModelEntryValue): WorldModelDataValue => (
  readWorldModel(Uint8Array.from(readFileSync(join(appRoot, 'public', buildWorldModelPath(entry)))).buffer)
);

type CornerValue = readonly [number, number, number];

interface TriangleValue {
  corners: readonly [CornerValue, CornerValue, CornerValue];
  isDark: boolean;
  isGlass: boolean;
}

const readTriangle = (data: WorldModelDataValue, triangle: number): TriangleValue => {
  const vertices = [0, 1, 2].map(corner => data.indices[triangle * 3 + corner] ?? 0);
  const [first, second, third] = vertices.map((vertex): CornerValue => [
    data.positions[vertex * 3] ?? 0,
    data.positions[vertex * 3 + 1] ?? 0,
    data.positions[vertex * 3 + 2] ?? 0,
  ]);

  return {
    corners: [first ?? [0, 0, 0], second ?? [0, 0, 0], third ?? [0, 0, 0]],
    isDark: vertices.every(vertex => data.roles[vertex] === DARK_ROLE),
    isGlass: vertices.every(vertex => data.roles[vertex] === GLASS_ROLE),
  };
};

const computeCross = ([first, second, third]: TriangleValue['corners']): CornerValue => {
  const [ux, uy, uz] = [0, 1, 2].map(axis => (second[axis] ?? 0) - (first[axis] ?? 0));
  const [vx, vy, vz] = [0, 1, 2].map(axis => (third[axis] ?? 0) - (first[axis] ?? 0));

  return [
    (uy ?? 0) * (vz ?? 0) - (uz ?? 0) * (vy ?? 0),
    (uz ?? 0) * (vx ?? 0) - (ux ?? 0) * (vz ?? 0),
    (ux ?? 0) * (vy ?? 0) - (uy ?? 0) * (vx ?? 0),
  ];
};

const measureGlassArea = (data: WorldModelDataValue): number => {
  let area = 0;

  for (let triangle = 0; triangle < data.triangleCount; triangle += 1) {
    const { corners, isGlass } = readTriangle(data, triangle);

    if (isGlass) {
      area += Math.hypot(...computeCross(corners)) / 2;
    }
  }

  return area;
};

const readOutwardPlane = (data: WorldModelDataValue, face: WorldModelFaceValue, inset: number): number => {
  const axis = face.endsWith('X') ? 0 : 2;

  return face.startsWith('positive') ? data.bounds.max[axis] - inset : data.bounds.min[axis] + inset;
};

interface WallTriangleValue extends TriangleValue {
  plane: number;
}

const listFlatWallTriangles = (data: WorldModelDataValue, face: WorldModelFaceValue): WallTriangleValue[] => {
  const axis = face.endsWith('X') ? 0 : 2;
  const sign = face.startsWith('positive') ? 1 : -1;
  const wall: WallTriangleValue[] = [];

  for (let triangle = 0; triangle < data.triangleCount; triangle += 1) {
    const candidate = readTriangle(data, triangle);
    const coordinates = candidate.corners.map(corner => corner[axis]);
    const isFlat = Math.max(...coordinates) - Math.min(...coordinates) < 1e-4;
    const normal = computeCross(candidate.corners)[axis];

    if (!candidate.isGlass && isFlat && Math.sign(normal) === sign) {
      wall.push({ ...candidate, plane: coordinates[0] ?? 0 });
    }
  }

  return wall;
};

const listWallTriangles = (data: WorldModelDataValue, face: WorldModelFaceValue, plane: number): TriangleValue[] =>
  listFlatWallTriangles(data, face).filter(triangle => Math.abs(triangle.plane - plane) <= WALL_PLANE_TOLERANCE);

const measureFacadeInset = (data: WorldModelDataValue, face: WorldModelFaceValue): number => {
  const areaByPlane = new Map<number, number>();

  for (const triangle of listFlatWallTriangles(data, face)) {
    const key = Math.round(triangle.plane / PLANE_GROUP_STEP);

    areaByPlane.set(key, (areaByPlane.get(key) ?? 0) + Math.hypot(...computeCross(triangle.corners)) / 2);
  }

  const [widestKey] = [...areaByPlane.entries()].toSorted(([, currentArea], [, prevArea]) => prevArea - currentArea)[0] ?? [0];
  const outerPlane = readOutwardPlane(data, face, 0);

  return Math.abs(outerPlane - widestKey * PLANE_GROUP_STEP);
};

const measureTop = (triangle: TriangleValue): number => Math.max(...triangle.corners.map(corner => corner[1]));

const measureBottom = (triangle: TriangleValue): number => Math.min(...triangle.corners.map(corner => corner[1]));

const listHorizontalExtent = (triangle: TriangleValue, face: WorldModelFaceValue): readonly [number, number] => {
  const axis = face.endsWith('X') ? 2 : 0;
  const values = triangle.corners.map(corner => corner[axis]);

  return [Math.min(...values), Math.max(...values)];
};

const listGateTriangles = (
  data: WorldModelDataValue,
  face: WorldModelFaceValue,
  inset: number,
  bandTop: number,
): TriangleValue[] => listWallTriangles(data, face, readOutwardPlane(data, face, inset))
  .filter(triangle => triangle.isDark && measureBottom(triangle) < bandTop);

const listBinFiles = (): string[] => readdirSync(modelsRoot, { recursive: true, withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.bin'))
  .map(entry => join(entry.parentPath, entry.name));

describe('world model files', () => {
  it('lists 14 models with unique ids and paths', () => {
    expect(WORLD_MODEL_CATALOG).toHaveLength(14);
    expect(new Set(WORLD_MODEL_CATALOG.map(({ id }) => id)).size).toBe(14);
    expect(new Set(WORLD_MODEL_CATALOG.map(buildWorldModelPath)).size).toBe(14);
    expect(WORLD_MODEL_CATALOG.some(({ id }) => id === COMPANY_WAREHOUSE_MODEL_ID)).toBe(true);
  });

  it.each(WORLD_MODEL_CATALOG)('has a readable file for $id', (entry) => {
    const data = readWorldModel(Uint8Array.from(readFileSync(join(appRoot, 'public', buildWorldModelPath(entry)))).buffer);

    expect(data.triangleCount).toBeGreaterThan(0);
    expect(data.bounds.min[1]).toBe(0);
  });

  it.each(WORLD_MODEL_CATALOG)('keeps the footprint of $id equal to the bounds of its file', (entry) => {
    const { bounds } = readWorldModel(Uint8Array.from(readFileSync(join(appRoot, 'public', buildWorldModelPath(entry)))).buffer);
    const { footprint } = entry;

    expect(Math.abs(footprint[0] - (bounds.max[0] - bounds.min[0]))).toBeLessThanOrEqual(FOOTPRINT_TOLERANCE);
    expect(Math.abs(footprint[1] - (bounds.max[2] - bounds.min[2]))).toBeLessThanOrEqual(FOOTPRINT_TOLERANCE);
  });

  it('has no other .bin files than the catalog', () => {
    const expected = WORLD_MODEL_CATALOG.map(entry => join(appRoot, 'public', buildWorldModelPath(entry))).toSorted();

    expect(listBinFiles().toSorted()).toEqual(expected);
  });

  it.each(KITS)('keeps the license of the %s kit next to its models', (kit) => {
    const path = join(modelsRoot, kit, 'License.txt');

    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toContain('Creative Commons Zero');
  });

  it('weighs at most 300 kB raw', () => {
    const totalBytes = listBinFiles().reduce((sum, path) => sum + statSync(path).size, 0);

    expect(totalBytes).toBeLessThanOrEqual(BUDGET_KILOBYTES * BYTES_PER_KILOBYTE);
  });

  it.each(FULL_ENTRIES.filter(({ group }) => group !== 'warehouse'))('lists a window of glass for the full model $id', (entry) => {
    expect(listWorldModelWindows(readEntryModel(entry)).length).toBeGreaterThanOrEqual(1);
  });

  it.each(WORLD_MODEL_CATALOG)('turns all the glass of $id into vertical rectangles', (entry) => {
    const data = readEntryModel(entry);
    const windowsArea = listWorldModelWindows(data).reduce((sum, { height, width }) => sum + width * height, 0);

    expect(Math.abs(windowsArea - measureGlassArea(data))).toBeLessThanOrEqual(GLASS_AREA_TOLERANCE * windowsArea + 1e-9);
  });

  it.each(WORLD_MODEL_CATALOG)('keeps $id centered on the origin of the ground plane', (entry) => {
    const { bounds } = readEntryModel(entry);

    expect(Math.abs(bounds.max[0] + bounds.min[0])).toBeLessThanOrEqual(CENTER_TOLERANCE);
    expect(Math.abs(bounds.max[2] + bounds.min[2])).toBeLessThanOrEqual(CENTER_TOLERANCE);
  });

  it.each(WORLD_MODEL_CATALOG)('gives walls to $id only when it has no glass or is the warehouse', (entry) => {
    const hasGlass = listWorldModelWindows(readEntryModel(entry)).length > 0;

    expect(entry.walls !== undefined).toBe(!hasGlass || entry.group === 'warehouse');
  });

  it.each(WORLD_MODEL_CATALOG.filter(({ walls }) => walls !== undefined))('puts the wall windows of $id on real walls', (entry) => {
    const data = readEntryModel(entry);

    for (const { face, inset } of entry.walls?.faces ?? []) {
      expect(listWallTriangles(data, face, readOutwardPlane(data, face, inset)).length).toBeGreaterThan(0);
    }
  });

  it.each(WORLD_MODEL_CATALOG)('puts the far wall windows of $id at the outer plane, not behind the facade or far in front', (entry) => {
    const data = readEntryModel(entry);
    const windowsTop = entry.farWalls.heightShare * data.bounds.max[1];

    expect(entry.farWalls.faces.length).toBeGreaterThanOrEqual(3);
    expect(entry.farWalls.heightShare).toBeGreaterThan(0);
    expect(entry.farWalls.heightShare).toBeLessThanOrEqual(1);

    for (const { face, inset } of entry.farWalls.faces) {
      const facadeInset = measureFacadeInset(data, face);
      const measureInset = (triangle: WallTriangleValue): number => Math.abs(readOutwardPlane(data, face, 0) - triangle.plane);
      const facade = listFlatWallTriangles(data, face).filter(
        triangle => measureInset(triangle) >= inset - WALL_PLANE_TOLERANCE && measureInset(triangle) <= facadeInset + WALL_PLANE_TOLERANCE,
      );

      expect(facade.length).toBeGreaterThan(0);
      expect(inset).toBeGreaterThanOrEqual(0);
      expect(inset).toBeLessThanOrEqual(facadeInset + WALL_PLANE_TOLERANCE);
      expect(facadeInset - inset).toBeLessThanOrEqual(MAX_FAR_FLOAT);
      expect(windowsTop).toBeLessThanOrEqual(Math.max(...facade.map(measureTop)) + EAVE_TOLERANCE);
    }
  });

  const WALLED_ENTRIES = WORLD_MODEL_CATALOG.filter(({ walls }) => walls !== undefined);

  it.each(WALLED_ENTRIES)('keeps the far walls of $id on the faces, band and doors of its walls', (entry) => {
    const walls = entry.walls?.faces ?? [];
    const listFacesAndDoors = (faces: readonly WorldModelWallFaceValue[]): (number | string)[][] =>
      faces.map(({ doorClearance, face }) => [face, doorClearance]);

    expect(entry.farWalls.heightShare).toBe(entry.walls?.heightShare);
    expect(listFacesAndDoors(entry.farWalls.faces)).toEqual(listFacesAndDoors(walls));

    for (const [index, { inset }] of entry.farWalls.faces.entries()) {
      expect(inset).toBeLessThanOrEqual(walls[index]?.inset ?? 0);
    }
  });

  it('keeps the windows of the warehouse off the gate and clear of the doors, by the geometry of its walls', () => {
    const warehouse = WORLD_MODEL_CATALOG.find(({ id }) => id === COMPANY_WAREHOUSE_MODEL_ID);

    expect(warehouse).toBeDefined();

    if (warehouse === undefined) {
      return;
    }

    const data = readEntryModel(warehouse);
    const bandTop = warehouse.farWalls.heightShare * data.bounds.max[1];
    const listedFaces = warehouse.farWalls.faces.map(({ face }) => face);
    const gateFaces = ALL_FACES.filter(face => !listedFaces.includes(face));

    expect(gateFaces).toHaveLength(1);

    for (const { doorClearance, face, inset } of warehouse.walls?.faces ?? []) {
      for (const triangle of listGateTriangles(data, face, inset, bandTop)) {
        const [low, high] = listHorizontalExtent(triangle, face);

        expect(Math.max(Math.abs(low), Math.abs(high))).toBeLessThanOrEqual(doorClearance + EAVE_TOLERANCE);
      }
    }

    for (const face of gateFaces) {
      const gates = [0, 0.044, 0.06].flatMap(inset => listGateTriangles(data, face, inset, bandTop));
      const widest = Math.max(...gates.map((triangle) => {
        const [low, high] = listHorizontalExtent(triangle, face);

        return high - low;
      }));

      expect(widest).toBeGreaterThanOrEqual(GATE_MIN_WIDTH);
    }
  });
});
