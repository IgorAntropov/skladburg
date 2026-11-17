import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  createTestCity,
  createTestModel,
  createTestRoad,
  createTestSite,
} from './layout/layoutTestSupport';
import { loadWorldModels } from './models/loadWorldModels';
import {
  buildWorldModelPath,
  INDUSTRIAL_YARD_MODEL,
  NETWORK_ROAD_MODEL,
  NETWORK_SCENERY_MODELS,
  WORLD_MODEL_CATALOG,
} from './models/worldModelCatalog';
import { createTestWorldModelBytes } from './models/worldModelTestSupport';
import { NETWORK_WORLD_SIZE_METERS } from './networkWorldConstants';
import {
  prepare,
  resolveWorld,
} from './NetworkWorldScene';

const MODEL_FILES = [...WORLD_MODEL_CATALOG, ...NETWORK_SCENERY_MODELS, INDUSTRIAL_YARD_MODEL];

const FAILING_MODEL_ID = NETWORK_ROAD_MODEL.id;
const FAILING_MODEL_PATH = buildWorldModelPath(NETWORK_ROAD_MODEL);

const createModel = (): ReturnType<typeof createTestModel> => createTestModel(
  [createTestCity('a', 4, 2), createTestCity('b', 7, 3)],
  [createTestRoad('a-b', 'a', 'b')],
  [createTestSite('own', 'a', true)],
);

describe('NetworkWorldScene module', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.error())));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gives the same world object for the same model and a different one for another model', () => {
    const model = createModel();

    expect(resolveWorld(model)).toBe(resolveWorld(model));
    expect(resolveWorld(createModel())).not.toBe(resolveWorld(model));
  });

  it('builds the world of the network map at its own size', () => {
    const { bounds } = resolveWorld(createModel());

    expect(bounds.maxX - bounds.minX).toBe(NETWORK_WORLD_SIZE_METERS);
    expect(bounds.maxZ - bounds.minZ).toBe(NETWORK_WORLD_SIZE_METERS);
  });

  it('puts the home of the world over the own warehouses', () => {
    const world = resolveWorld(createModel());

    expect(world.home.radius).toBeGreaterThanOrEqual(20);
    expect(Math.hypot(world.home.centerX, world.home.centerZ)).toBeGreaterThan(0);
  });

  it('prepares the terrain of the model and reuses it for the same model', async () => {
    const model = createModel();

    await expect(prepare(model)).resolves.toBeUndefined();
    await expect(prepare(model)).resolves.toBeUndefined();
  });

  it('does not request an industrial yard for a map with no warehouses', async () => {
    const model = createTestModel([createTestCity('a', 4, 2)], [], []);

    await expect(prepare(model)).resolves.toBeUndefined();

    const yardUrl = `${import.meta.env.BASE_URL}${buildWorldModelPath(INDUSTRIAL_YARD_MODEL)}`;

    expect(fetch).not.toHaveBeenCalledWith(yardUrl);
  });

  it('asks for every model once, keeps loading the others when one fails and loads the failed one on the next prepare', async () => {
    const requested: string[] = [];

    vi.stubGlobal('fetch', vi.fn((url: string) => {
      requested.push(url);

      return Promise.resolve(Response.error());
    }));

    await expect(prepare(createModel())).resolves.toBeUndefined();

    const requestedUrls = requested.toSorted();

    expect(requestedUrls).toHaveLength(MODEL_FILES.length);
    expect(requestedUrls).toEqual(MODEL_FILES.map(entry => `${import.meta.env.BASE_URL}${buildWorldModelPath(entry)}`).toSorted());

    for (const { id } of MODEL_FILES) {
      expect(loadWorldModels.peek(id)).toBeUndefined();
    }

    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(
      url.endsWith(FAILING_MODEL_PATH) ? Response.error() : new Response(createTestWorldModelBytes()),
    )));

    await expect(prepare(createModel())).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(MODEL_FILES.length);
    expect(loadWorldModels.peek(FAILING_MODEL_ID)).toBeUndefined();

    for (const { id } of MODEL_FILES.filter(entry => entry.id !== FAILING_MODEL_ID)) {
      expect(loadWorldModels.peek(id)?.triangleCount).toBeGreaterThan(0);
    }

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(createTestWorldModelBytes()))));

    await expect(prepare(createModel())).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(1);

    for (const { id } of MODEL_FILES) {
      expect(loadWorldModels.peek(id)?.triangleCount).toBeGreaterThan(0);
    }
  });
});
