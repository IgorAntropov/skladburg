import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const SCENE_PATH = '../scene/NetworkWorldScene';

const sceneMocks = vi.hoisted(() => ({
  factoryCallCount: 0,
  prepare: vi.fn<() => Promise<void>>(),
}));

const createSceneModuleMock = (): Record<string, unknown> => {
  sceneMocks.factoryCallCount += 1;

  return {
    default: () => null,
    prepare: sceneMocks.prepare,
    resolveWorld: () => ({}),
  };
};

describe('loadNetworkScene', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock(SCENE_PATH);
    sceneMocks.factoryCallCount = 0;
    sceneMocks.prepare.mockReset();
  });

  it('gives the scene module at once without preparing it', async () => {
    vi.doMock(SCENE_PATH, createSceneModuleMock);
    const { loadNetworkScene } = await import('./loadNetworkScene');

    const sceneModule = await loadNetworkScene();

    expect(sceneModule.default).toBeTypeOf('function');
    expect(sceneModule.resolveWorld).toBeTypeOf('function');
    expect(sceneMocks.prepare).not.toHaveBeenCalled();
    expect(loadNetworkScene.peekLoadedModule()).toBe(sceneModule);
  });

  it('imports the scene once and keeps the module for the next calls', async () => {
    vi.doMock(SCENE_PATH, createSceneModuleMock);
    const { loadNetworkScene } = await import('./loadNetworkScene');

    const first = await loadNetworkScene();
    const second = await loadNetworkScene();

    expect(second).toBe(first);
    expect(sceneMocks.factoryCallCount).toBe(1);
  });

  it('rejects with the chunk error when the import fails and imports again on the retry', async () => {
    vi.doMock(SCENE_PATH, () => {
      throw new Error('the scene chunk is unavailable');
    });
    const { loadNetworkScene } = await import('./loadNetworkScene');

    const failure: unknown = await loadNetworkScene().then(() => undefined, (error: unknown) => error);

    expect(failure).toMatchObject({ attempt: 1, name: 'ChunkLoadError' });
    expect(loadNetworkScene.peekLoadedModule()).toBeUndefined();

    vi.doMock(SCENE_PATH, createSceneModuleMock);

    await expect(loadNetworkScene()).resolves.toBeDefined();
  });
});
