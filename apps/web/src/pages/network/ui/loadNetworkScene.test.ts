import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const sceneMocks = vi.hoisted(() => ({
  prepare: vi.fn<() => Promise<void>>(),
}));

vi.mock('../scene/NetworkWorldScene', () => ({
  default: () => null,
  prepare: sceneMocks.prepare,
  world: {},
}));

describe('loadNetworkScene', () => {
  beforeEach(() => {
    vi.resetModules();
    sceneMocks.prepare.mockReset();
  });

  it('gives the scene module only after its preparation has finished', async () => {
    let finishPreparation: () => void = () => undefined;

    sceneMocks.prepare.mockImplementation(() => new Promise<void>((resolve) => {
      finishPreparation = resolve;
    }));
    const { loadNetworkScene } = await import('./loadNetworkScene');
    const onLoaded = vi.fn();

    const loading = loadNetworkScene().then(onLoaded);
    await vi.waitFor(() => {
      expect(sceneMocks.prepare).toHaveBeenCalledOnce();
    });

    expect(onLoaded).not.toHaveBeenCalled();
    expect(loadNetworkScene.peekLoadedModule()).toBeUndefined();

    finishPreparation();
    await loading;

    expect(onLoaded).toHaveBeenCalledOnce();
    expect(loadNetworkScene.peekLoadedModule()).toBeDefined();
  });

  it('prepares the scene once and keeps the module for the next calls', async () => {
    sceneMocks.prepare.mockResolvedValue(undefined);
    const { loadNetworkScene } = await import('./loadNetworkScene');

    const first = await loadNetworkScene();
    const second = await loadNetworkScene();

    expect(second).toBe(first);
    expect(sceneMocks.prepare).toHaveBeenCalledOnce();
  });

  it('rejects with the chunk error when the preparation fails and prepares again on the retry', async () => {
    sceneMocks.prepare
      .mockRejectedValueOnce(new Error('the fallback chunk is unavailable'))
      .mockResolvedValueOnce(undefined);
    const { loadNetworkScene } = await import('./loadNetworkScene');

    const failure: unknown = await loadNetworkScene().then(() => undefined, (error: unknown) => error);

    expect(failure).toMatchObject({ attempt: 1, name: 'ChunkLoadError' });
    expect(loadNetworkScene.peekLoadedModule()).toBeUndefined();

    await expect(loadNetworkScene()).resolves.toBeDefined();
    expect(sceneMocks.prepare).toHaveBeenCalledTimes(2);
  });
});
