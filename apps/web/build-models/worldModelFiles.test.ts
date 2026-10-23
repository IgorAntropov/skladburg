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
import type { WorldModelFaceValue } from '../src/pages/network/scene/models/listWorldModelWindows.ts';
import type { WorldModelEntryValue } from '../src/pages/network/scene/models/worldModelCatalog.ts';

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

const CENTER_TOLERANCE = 0.01;

const GLASS_ROLE = WORLD_MODEL_ROLES.indexOf('glass');

const FULL_ENTRIES = WORLD_MODEL_CATALOG.filter(({ lod }) => lod === 'full');

const readEntryModel = (entry: WorldModelEntryValue): WorldModelDataValue => (
  readWorldModel(Uint8Array.from(readFileSync(join(appRoot, 'public', buildWorldModelPath(entry)))).buffer)
);

type CornerValue = readonly [number, number, number];

interface TriangleValue {
  corners: readonly [CornerValue, CornerValue, CornerValue];
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

const hasWallAtPlane = (data: WorldModelDataValue, face: WorldModelFaceValue, plane: number): boolean => {
  const axis = face.endsWith('X') ? 0 : 2;
  const sign = face.startsWith('positive') ? 1 : -1;

  for (let triangle = 0; triangle < data.triangleCount; triangle += 1) {
    const { corners, isGlass } = readTriangle(data, triangle);
    const coordinates = corners.map(corner => corner[axis]);
    const isFlat = Math.max(...coordinates) - Math.min(...coordinates) < 1e-4;
    const normal = computeCross(corners)[axis];

    if (!isGlass && isFlat && Math.sign(normal) === sign && Math.abs((coordinates[0] ?? 0) - plane) <= WALL_PLANE_TOLERANCE) {
      return true;
    }
  }

  return false;
};

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
      const outward = face.startsWith('positive')
        ? data.bounds.max[face.endsWith('X') ? 0 : 2] - inset
        : data.bounds.min[face.endsWith('X') ? 0 : 2] + inset;

      expect(hasWallAtPlane(data, face, outward)).toBe(true);
    }
  });

  it('keeps the windows of the warehouse off the wall with the gate', () => {
    const warehouse = WORLD_MODEL_CATALOG.find(({ id }) => id === COMPANY_WAREHOUSE_MODEL_ID);

    expect(warehouse?.walls?.faces.map(({ face }) => face)).toEqual(['positiveX', 'positiveZ', 'negativeZ']);
  });
});
