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
  CORNER_BASE_HEIGHT_METERS,
  CORNER_LIGHT_THICKNESS_METERS,
  PLAZA_HEIGHT_METERS,
  SITE_CORNER_BAR_WIDTH_METERS,
  SITE_CORNER_GAP_METERS,
  SITE_CORNER_LENGTH_METERS,
} from '../src/pages/network/scene/geometry/networkSceneMetrics.ts';
import { WAREHOUSE_SIZE_METERS } from '../src/pages/network/scene/layout/layoutConstants.ts';
import {
  readWorldModel,
  WORLD_MODEL_ROLES,
} from '../src/pages/network/scene/models/format/worldModelFormat.ts';
import { listWorldModelWindows } from '../src/pages/network/scene/models/listWorldModelWindows.ts';
import {
  buildWorldModelPath,
  COMPANY_WAREHOUSE_MODEL_ID,
  INDUSTRIAL_YARD_MODEL,
  NETWORK_TRUCK_LIGHT_MODEL,
  NETWORK_TRUCK_MODEL,
  WORLD_AUXILIARY_MODELS,
  WORLD_MODEL_CATALOG,
} from '../src/pages/network/scene/models/worldModelCatalog.ts';
import {
  INDUSTRIAL_YARD_DEPTH,
  INDUSTRIAL_YARD_WIDTH,
} from '../src/pages/network/scene/yard/industrialYardSize.ts';

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
    const expected = [...WORLD_MODEL_CATALOG, ...WORLD_AUXILIARY_MODELS].map(
      entry => join(appRoot, 'public', buildWorldModelPath(entry)),
    ).toSorted();

    expect(listBinFiles().toSorted()).toEqual(expected);
  });

  it.each([
    { entry: NETWORK_TRUCK_MODEL, maxBytes: 40_000, maxTriangles: 2200 },
    { entry: NETWORK_TRUCK_LIGHT_MODEL, maxBytes: 14_000, maxTriangles: 624 },
  ])('keeps $entry.id within its road and scene budgets', ({ entry, maxBytes, maxTriangles }) => {
    const path = join(appRoot, 'public', buildWorldModelPath(entry));
    const bytes = Uint8Array.from(readFileSync(path));
    const { bounds, roles, triangleCount } = readWorldModel(bytes.buffer);
    expect(bytes.byteLength).toBeLessThanOrEqual(maxBytes);
    expect(triangleCount).toBeLessThanOrEqual(maxTriangles);
    expect(bounds.min[0]).toBeGreaterThanOrEqual(-0.506);
    expect(bounds.min[1]).toBe(0);
    expect(bounds.min[2]).toBeGreaterThanOrEqual(-1.081);
    expect(bounds.max[0]).toBeLessThanOrEqual(0.506);
    expect(bounds.max[1]).toBeLessThanOrEqual(0.981);
    expect(bounds.max[2]).toBeLessThanOrEqual(1.041);
    expect([...new Set(roles)].map(role => WORLD_MODEL_ROLES[role])).toEqual(
      expect.arrayContaining(['dark', 'glass', 'light', 'mid']),
    );
  });

  it('keeps the loading yard inside the lot used for placement and gives its props palette roles', () => {
    const path = join(appRoot, 'public', buildWorldModelPath(INDUSTRIAL_YARD_MODEL));
    const { bounds, roles, triangleCount } = readWorldModel(Uint8Array.from(readFileSync(path)).buffer);

    expect(bounds.min[0]).toBeCloseTo(-INDUSTRIAL_YARD_WIDTH / 2);
    expect(bounds.max[0]).toBeCloseTo(INDUSTRIAL_YARD_WIDTH / 2);
    expect(bounds.min[1]).toBe(0);
    expect(bounds.min[2]).toBeCloseTo(-INDUSTRIAL_YARD_DEPTH / 2);
    expect(bounds.max[2]).toBeCloseTo(INDUSTRIAL_YARD_DEPTH / 2);
    expect(triangleCount).toBeLessThan(2000);
    const palette = [...new Set(roles)].map(role => WORLD_MODEL_ROLES[role]);

    expect(palette).toEqual(expect.arrayContaining(['dark', 'glass', 'green', 'light', 'red', 'yellow']));
  });

  it('leaves the light selection corners above the loading yard', () => {
    const path = join(appRoot, 'public', buildWorldModelPath(INDUSTRIAL_YARD_MODEL));
    const model = readWorldModel(Uint8Array.from(readFileSync(path)).buffer);
    const yardFrameRight = INDUSTRIAL_YARD_WIDTH / 2 - SITE_CORNER_GAP_METERS;
    const yardFrameLeft = yardFrameRight - SITE_CORNER_BAR_WIDTH_METERS;
    const yardFrameNear = WAREHOUSE_SIZE_METERS.depth / 2 + SITE_CORNER_GAP_METERS
      - SITE_CORNER_LENGTH_METERS + SITE_CORNER_BAR_WIDTH_METERS;
    const yardFrameHeight = CORNER_BASE_HEIGHT_METERS + CORNER_LIGHT_THICKNESS_METERS / 2 - PLAZA_HEIGHT_METERS;
    const obstructingTriangles = Array.from({ length: model.triangleCount }, (_, index) => readTriangle(model, index))
      .filter(({ corners }) => {
        const xs = corners.map(([x]) => x);
        const ys = corners.map(([, y]) => y);
        const zs = corners.map(([, , z]) => z);
        const overlapsFrameX = Math.min(...xs) <= yardFrameRight && Math.max(...xs) >= yardFrameLeft;
        const overlapsFrameZ = Math.max(...zs) >= yardFrameNear || Math.min(...zs) <= -yardFrameNear;

        return overlapsFrameX && overlapsFrameZ && Math.max(...ys) >= yardFrameHeight;
      });

    expect(obstructingTriangles).toHaveLength(0);
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

  it.each(WORLD_MODEL_CATALOG)('gives near wall windows to $id only when it has no glass', (entry) => {
    const hasGlass = listWorldModelWindows(readEntryModel(entry)).length > 0;

    expect(entry.walls !== undefined).toBe(!hasGlass);
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

  it('fits the warehouse glazing to three walls and reserves the fourth wall for the gate', () => {
    const warehouse = WORLD_MODEL_CATALOG.find(({ id }) => id === COMPANY_WAREHOUSE_MODEL_ID);

    expect(warehouse).toBeDefined();

    if (warehouse === undefined) {
      return;
    }

    const data = readEntryModel(warehouse);
    const bandTop = warehouse.farWalls.heightShare * data.bounds.max[1];
    const listedFaces = warehouse.farWalls.faces.map(({ face }) => face);
    const gateFaces = ALL_FACES.filter(face => !listedFaces.includes(face));
    const windows = listWorldModelWindows(data);

    expect(gateFaces).toHaveLength(1);
    expect(windows.filter(({ face }) => face === 'positiveX')).toHaveLength(2);
    expect(windows.filter(({ face }) => face === 'positiveZ')).toHaveLength(4);
    expect(windows.filter(({ face }) => face === 'negativeZ')).toHaveLength(4);
    expect(windows.filter(({ face }) => face === 'negativeX')).toHaveLength(0);

    for (const face of gateFaces) {
      const facadePlane = readOutwardPlane(data, face, 0);
      const gates = listFlatWallTriangles(data, face).filter(
        triangle => triangle.isDark && Math.abs(triangle.plane - facadePlane) < 0.065 && measureBottom(triangle) < bandTop,
      );
      const widest = Math.max(...gates.map((triangle) => {
        const [low, high] = listHorizontalExtent(triangle, face);

        return high - low;
      }));

      expect(widest).toBeGreaterThanOrEqual(GATE_MIN_WIDTH);
    }
  });
});
