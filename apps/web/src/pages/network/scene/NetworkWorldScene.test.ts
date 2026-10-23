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
  WORLD_MODEL_CATALOG,
} from './models/worldModelCatalog';
import { createTestWorldModelBytes } from './models/worldModelTestSupport';
import { NETWORK_WORLD_SIZE_METERS } from './networkWorldConstants';
import {
  prepare,
  resolveWorld,
} from './NetworkWorldScene';

const FAILING_MODEL_ID = 'commercial/building-a';
const FAILING_MODEL_PATH = 'models/commercial/building-a.bin';

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

  it('asks for every model once, keeps loading the others when one fails and loads the failed one on the next prepare', async () => {
    const requested: string[] = [];

    vi.stubGlobal('fetch', vi.fn((url: string) => {
      requested.push(url);

      return Promise.resolve(Response.error());
    }));

    await expect(prepare(createModel())).resolves.toBeUndefined();

    const requestedUrls = requested.toSorted();

    expect(requestedUrls).toHaveLength(WORLD_MODEL_CATALOG.length);
    expect(requestedUrls).toEqual(WORLD_MODEL_CATALOG.map(entry => `${import.meta.env.BASE_URL}${buildWorldModelPath(entry)}`).toSorted());

    for (const { id } of WORLD_MODEL_CATALOG) {
      expect(loadWorldModels.peek(id)).toBeUndefined();
    }

    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(
      url.endsWith(FAILING_MODEL_PATH) ? Response.error() : new Response(createTestWorldModelBytes()),
    )));

    await expect(prepare(createModel())).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(WORLD_MODEL_CATALOG.length);
    expect(loadWorldModels.peek(FAILING_MODEL_ID)).toBeUndefined();

    for (const { id } of WORLD_MODEL_CATALOG.filter(entry => entry.id !== FAILING_MODEL_ID)) {
      expect(loadWorldModels.peek(id)?.triangleCount).toBeGreaterThan(0);
    }

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(createTestWorldModelBytes()))));

    await expect(prepare(createModel())).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(1);

    for (const { id } of WORLD_MODEL_CATALOG) {
      expect(loadWorldModels.peek(id)?.triangleCount).toBeGreaterThan(0);
    }
  });
});
