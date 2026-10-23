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
import { COMPANY_WAREHOUSE_MODEL_ID } from './models/worldModelCatalog';
import { createTestWorldModelBytes } from './models/worldModelTestSupport';
import { NETWORK_WORLD_SIZE_METERS } from './networkWorldConstants';
import {
  prepare,
  resolveWorld,
} from './NetworkWorldScene';

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

  it('leaves the warehouses as boxes while the models are not available and keeps the model once it loads', async () => {
    await expect(prepare(createModel())).resolves.toBeUndefined();
    expect(loadWorldModels.peek(COMPANY_WAREHOUSE_MODEL_ID)).toBeUndefined();

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(createTestWorldModelBytes()))));

    await expect(prepare(createModel())).resolves.toBeUndefined();

    const warehouse = loadWorldModels.peek(COMPANY_WAREHOUSE_MODEL_ID);

    expect(warehouse?.triangleCount).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
