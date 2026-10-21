import type { RenderResult } from '@testing-library/react';
import type {
  ReactElement,
  ReactNode,
} from 'react';
import type { Mock } from 'vitest';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useEffect } from 'react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  QualityLevelValue,
  SceneContentProps,
  SceneWorldValue,
} from '@/shared/3d';
import type { CachedModuleLoader } from '@/shared/lib/module-loader';
import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import { useSceneSettingsStore } from '@/features/scene-settings';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import {
  ChunkLoadError,
  createCachedModuleLoader,
} from '@/shared/lib/module-loader';
import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';
import {
  createThemePreferenceStore,
  ThemePreferenceProvider,
} from '@/shared/theme';

import type { SceneModuleValue } from '../model/sceneViewportTypes';

import { loadSceneRoot } from '../lib/loadSceneRoot';
import { isWebGlSupported } from '../lib/webGlSupport';
import { SceneViewport } from './SceneViewport';

const sceneRootControl = vi.hoisted(() => ({ isBroken: false, mountCount: 0 }));

vi.mock('../lib/webGlSupport', () => ({
  isSoftwareRenderer: vi.fn(() => false),
  isWebGlSupported: vi.fn(() => true),
}));

vi.mock('../scene/SceneRoot', () => {
  const SceneRoot = ({
    autoQuality,
    content,
    onAutoLevelChange,
    onContextLost,
    onReady,
    world,
  }: {
    autoQuality: undefined | { ceiling: QualityLevelValue; changeCount: number };
    content: ReactNode;
    onAutoLevelChange: (level: QualityLevelValue) => void;
    onContextLost: () => void;
    onReady: () => void;
    world: SceneWorldValue;
  }): ReactElement => {
    if (sceneRootControl.isBroken) {
      throw new Error('the WebGL context was not created');
    }

    useEffect(() => {
      sceneRootControl.mountCount += 1;
    }, []);

    useEffect(() => {
      onReady();
    }, [onReady]);

    return (
      <div
        data-auto-ceiling={autoQuality?.ceiling}
        data-change-count={autoQuality?.changeCount}
        data-testid="scene-root-probe"
        data-world-radius={world.home.radius}
      >
        <button data-testid="lose-context" onClick={onContextLost} type="button" />
        <button data-testid="change-auto-level" onClick={() => { onAutoLevelChange('low'); }} type="button" />
        {content}
      </div>
    );
  };

  return { default: SceneRoot };
});

const LABEL = 'Network label';
const SCENE_STATE_ATTRIBUTE = 'data-scene-state';
const RETRY_NAME = defaultLocaleCatalog['common.retry'];
const RELOAD_NAME = defaultLocaleCatalog['routing.chunkError.reload'];
const REPEATED_MESSAGE = defaultLocaleCatalog['scene.error.repeated'];
const NO_WEBGL_MESSAGE = defaultLocaleCatalog['scene.off.noWebGl'];
const PREFERENCE_MESSAGE = defaultLocaleCatalog['scene.off.preference'];
const PHONE_MESSAGE = defaultLocaleCatalog['scene.off.phoneDefault'];
const ENABLE_NAME = defaultLocaleCatalog['scene.off.enable'];

interface TestSceneDataValue {
  radius: number;
  value: string;
}

type TestSceneModuleValue = SceneModuleValue<TestSceneDataValue>;

const SCENE_DATA: TestSceneDataValue = { radius: 1, value: 'first' };

const createWorld = (radius: number): SceneWorldValue => ({
  bounds: { maxX: 1, maxZ: 1, minX: -1, minZ: -1 },
  home: { centerX: 0, centerZ: 0, radius },
  maxHeight: 1,
});

const SceneContent = ({ data, level }: SceneContentProps<TestSceneDataValue>): ReactElement => (
  <span data-level={level} data-testid="scene-content" data-value={data.value} />
);

const createSceneModule = (prepare: TestSceneModuleValue['prepare'] = () => Promise.resolve()): TestSceneModuleValue => ({
  default: SceneContent,
  prepare,
  resolveWorld: data => createWorld(data.radius),
});

const loadSceneModule = (): Promise<TestSceneModuleValue> => Promise.resolve(createSceneModule());

const createFailingThenLoadingScene = (failureCount: number): Mock<() => Promise<TestSceneModuleValue>> => {
  let failedCount = 0;

  return vi.fn(() => {
    if (failedCount < failureCount) {
      failedCount += 1;

      return Promise.reject(new Error('the scene chunk is unavailable'));
    }

    return loadSceneModule();
  });
};

interface IDeferredPreparation {
  fail: (error: unknown) => void;
  finish: () => void;
  promise: Promise<void>;
}

const createDeferredPreparation = (): IDeferredPreparation => {
  let finish: () => void = () => undefined;
  let fail: (error: unknown) => void = () => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });

  return { fail, finish, promise };
};

let installedViewport: IFakeViewport | undefined;
let memoryLocation: IMemoryLocation;

const themeStore = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });

const createViewportTree = (
  loadScene: CachedModuleLoader<TestSceneModuleValue>,
  sceneData: TestSceneDataValue | undefined,
): ReactElement => (
  <ThemePreferenceProvider store={themeStore}>
    <RoutingProvider location={memoryLocation}>
      <SceneViewport interaction={undefined} label={LABEL} loadScene={loadScene} sceneData={sceneData} />
    </RoutingProvider>
  </ThemePreferenceProvider>
);

const renderViewportWithData = (
  loadScene: CachedModuleLoader<TestSceneModuleValue>,
  sceneData: TestSceneDataValue | undefined,
): RenderResult => render(withTestLocalizer(createViewportTree(loadScene, sceneData)));

const renderViewport = (loadScene: CachedModuleLoader<TestSceneModuleValue>): RenderResult => {
  return renderViewportWithData(loadScene, SCENE_DATA);
};

const renderImportedViewport = (loadSceneImport: () => Promise<TestSceneModuleValue>): RenderResult => {
  return renderViewport(createCachedModuleLoader(loadSceneImport));
};

const getSceneState = (): null | string => screen.getByTestId('scene-viewport').getAttribute(SCENE_STATE_ATTRIBUTE);

describe('SceneViewport', () => {
  beforeEach(() => {
    installedViewport = installFakeViewport('desktop');
    memoryLocation = createMemoryLocation('/network');
    useSceneSettingsStore.setState({
      autoLevel: undefined,
      autoLevelChangeCount: 0,
      isSceneUnavailable: false,
      preference: undefined,
    });
    vi.mocked(isWebGlSupported).mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sceneRootControl.isBroken = false;
    sceneRootControl.mountCount = 0;
  });

  afterEach(() => {
    cleanup();
    installedViewport?.restore();
    vi.restoreAllMocks();
  });

  describe('light mode', () => {
    it('does not request the scene chunk when 3D is switched off', () => {
      useSceneSettingsStore.setState({ preference: 'off' });
      const loadSceneImport = vi.fn(loadSceneModule);

      renderImportedViewport(loadSceneImport);

      expect(getSceneState()).toBe('off');
      expect(screen.getByText(PREFERENCE_MESSAGE)).toBeTruthy();
      expect(loadSceneImport).not.toHaveBeenCalled();
      expect(screen.queryByTestId('scene-root-probe')).toBeNull();
    });

    it('is on by default on a phone and explains how to turn 3D on', () => {
      installedViewport?.setViewportClass('phone');
      const loadSceneImport = vi.fn(loadSceneModule);

      renderImportedViewport(loadSceneImport);

      expect(getSceneState()).toBe('off');
      expect(screen.getByText(PHONE_MESSAGE)).toBeTruthy();
      expect(loadSceneImport).not.toHaveBeenCalled();
    });

    it('turns 3D on from the button on a phone', async () => {
      installedViewport?.setViewportClass('phone');
      renderImportedViewport(loadSceneModule);

      fireEvent.click(screen.getByRole('button', { name: ENABLE_NAME }));

      await waitFor(() => {
        expect(getSceneState()).toBe('ready');
      });
      expect(useSceneSettingsStore.getState().preference).toBe('auto');
    });

    it('offers the enable button only in the phone default', () => {
      useSceneSettingsStore.setState({ preference: 'off' });

      renderImportedViewport(loadSceneModule);

      expect(screen.queryByRole('button', { name: ENABLE_NAME })).toBeNull();
    });

    it('turns itself on without WebGL and does not request the scene chunk', () => {
      vi.mocked(isWebGlSupported).mockReturnValue(false);
      const loadSceneImport = vi.fn(loadSceneModule);

      renderImportedViewport(loadSceneImport);

      expect(getSceneState()).toBe('off');
      expect(screen.getByText(NO_WEBGL_MESSAGE)).toBeTruthy();
      expect(loadSceneImport).not.toHaveBeenCalled();
    });

    it('loads the scene when 3D is switched back on from the menu', async () => {
      useSceneSettingsStore.setState({ preference: 'off' });
      renderImportedViewport(loadSceneModule);

      useSceneSettingsStore.setState({ preference: 'high' });

      await waitFor(() => {
        expect(getSceneState()).toBe('ready');
      });
    });
  });

  describe('3D mode', () => {
    it('is loading until the scene is ready, then ready', async () => {
      let openGate: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        openGate = resolve;
      });

      renderImportedViewport(() => gate.then(loadSceneModule));

      expect(getSceneState()).toBe('loading');
      expect(screen.queryByTestId('scene-root-probe')).toBeNull();

      openGate();

      await waitFor(() => {
        expect(getSceneState()).toBe('ready');
      });
      expect(['high', 'low', 'medium']).toContain(screen.getByTestId('scene-content').dataset.level);
    });

    it('mounts an already loaded scene as soon as its data is prepared', async () => {
      const loadScene = createCachedModuleLoader(loadSceneModule);
      await Promise.all([loadScene(), loadSceneRoot()]);

      renderViewport(loadScene);

      expect(await screen.findByTestId('scene-root-probe')).toBeTruthy();
    });

    it('offers a retry after the first chunk failure and loads again', async () => {
      const loadSceneImport = createFailingThenLoadingScene(1);

      renderImportedViewport(loadSceneImport);
      const retryButton = await screen.findByRole('button', { name: RETRY_NAME });

      expect(getSceneState()).toBe('error');

      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(getSceneState()).toBe('ready');
      });
      expect(loadSceneImport).toHaveBeenCalledTimes(2);
    });

    it('asks to reload the page after the second chunk failure', async () => {
      renderImportedViewport(createFailingThenLoadingScene(2));

      fireEvent.click(await screen.findByRole('button', { name: RETRY_NAME }));
      const reloadButton = await screen.findByRole('button', { name: RELOAD_NAME });

      expect(getSceneState()).toBe('error');
      expect(screen.getByText(REPEATED_MESSAGE)).toBeTruthy();

      fireEvent.click(reloadButton);

      expect(memoryLocation.reloadCount).toBe(1);
    });

    it('falls back to the light mode when the scene fails to render', async () => {
      sceneRootControl.isBroken = true;

      renderImportedViewport(loadSceneModule);

      await waitFor(() => {
        expect(getSceneState()).toBe('off');
      });
      expect(screen.getByText(NO_WEBGL_MESSAGE)).toBeTruthy();
      expect(screen.queryByRole('button')).toBeNull();
      expect(useSceneSettingsStore.getState().isSceneUnavailable).toBe(true);
    });
  });

  describe('scene data', () => {
    const SECOND_DATA: TestSceneDataValue = { radius: 5, value: 'second' };

    const rerenderViewport = (
      view: RenderResult,
      loadScene: CachedModuleLoader<TestSceneModuleValue>,
      sceneData: TestSceneDataValue | undefined,
    ): void => {
      view.rerender(withTestLocalizer(createViewportTree(loadScene, sceneData)));
    };

    it('stays loading without data and does not prepare the scene', async () => {
      const prepare = vi.fn(() => Promise.resolve());
      const loadScene = createCachedModuleLoader(() => Promise.resolve(createSceneModule(prepare)));

      const view = renderViewportWithData(loadScene, undefined);
      await waitFor(() => {
        expect(loadScene.peekLoadedModule()).toBeDefined();
      });

      expect(getSceneState()).toBe('loading');
      expect(prepare).not.toHaveBeenCalled();
      expect(screen.queryByTestId('scene-root-probe')).toBeNull();

      rerenderViewport(view, loadScene, SCENE_DATA);

      await waitFor(() => {
        expect(getSceneState()).toBe('ready');
      });
      expect(prepare).toHaveBeenCalledOnce();
    });

    it('prepares the data once and hands it to the content with the level', async () => {
      const prepare = vi.fn(() => Promise.resolve());

      renderViewport(createCachedModuleLoader(() => Promise.resolve(createSceneModule(prepare))));
      const content = await screen.findByTestId('scene-content');

      expect(prepare).toHaveBeenCalledExactlyOnceWith(SCENE_DATA);
      expect(content.dataset.value).toBe('first');
      expect(['high', 'low', 'medium']).toContain(content.dataset.level);
      expect(screen.getByTestId('scene-root-probe').dataset.worldRadius).toBe('1');
    });

    it('keeps the prepared content while the new data is being prepared, then swaps it with a new world', async () => {
      const secondPreparation = createDeferredPreparation();
      const prepare = vi.fn((data: TestSceneDataValue) => data === SECOND_DATA ? secondPreparation.promise : Promise.resolve());
      const loadScene = createCachedModuleLoader(() => Promise.resolve(createSceneModule(prepare)));
      const view = renderViewport(loadScene);
      await screen.findByTestId('scene-content');

      rerenderViewport(view, loadScene, SECOND_DATA);
      await waitFor(() => {
        expect(prepare).toHaveBeenCalledTimes(2);
      });

      expect(screen.getByTestId('scene-content').dataset.value).toBe('first');
      expect(screen.getByTestId('scene-root-probe').dataset.worldRadius).toBe('1');

      secondPreparation.finish();

      await waitFor(() => {
        expect(screen.getByTestId('scene-content').dataset.value).toBe('second');
      });
      expect(screen.getByTestId('scene-root-probe').dataset.worldRadius).toBe('5');
      expect(sceneRootControl.mountCount).toBe(1);
    });

    it('drops the answer of an outdated preparation', async () => {
      const firstPreparation = createDeferredPreparation();
      const prepare = vi.fn((data: TestSceneDataValue) => data === SCENE_DATA ? firstPreparation.promise : Promise.resolve());
      const loadScene = createCachedModuleLoader(() => Promise.resolve(createSceneModule(prepare)));
      const view = renderViewport(loadScene);
      await waitFor(() => {
        expect(prepare).toHaveBeenCalledOnce();
      });

      rerenderViewport(view, loadScene, SECOND_DATA);
      await waitFor(() => {
        expect(screen.getByTestId('scene-content').dataset.value).toBe('second');
      });

      await act(async () => {
        firstPreparation.finish();
        await firstPreparation.promise;
      });

      expect(screen.getByTestId('scene-content').dataset.value).toBe('second');
      expect(screen.getByTestId('scene-root-probe').dataset.worldRadius).toBe('5');
    });

    it('treats a failed preparation as a scene failure and falls back to the light mode', async () => {
      const prepare = vi.fn(() => Promise.reject(new Error('the terrain is not generated')));

      renderViewport(createCachedModuleLoader(() => Promise.resolve(createSceneModule(prepare))));

      await waitFor(() => {
        expect(getSceneState()).toBe('off');
      });
      expect(screen.getByText(NO_WEBGL_MESSAGE)).toBeTruthy();
      expect(useSceneSettingsStore.getState().isSceneUnavailable).toBe(true);
    });

    it('offers a retry when the preparation fails with a chunk error and prepares again', async () => {
      const prepare = vi.fn<TestSceneModuleValue['prepare']>()
        .mockRejectedValueOnce(new ChunkLoadError(1))
        .mockResolvedValue(undefined);

      renderViewport(createCachedModuleLoader(() => Promise.resolve(createSceneModule(prepare))));
      const retryButton = await screen.findByRole('button', { name: RETRY_NAME });

      expect(getSceneState()).toBe('error');

      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(getSceneState()).toBe('ready');
      });
      expect(prepare).toHaveBeenCalledTimes(2);
    });
  });

  describe('automatic quality', () => {
    it('hands the monitor the stored count of changes on Auto', async () => {
      useSceneSettingsStore.setState({ autoLevelChangeCount: 2 });

      renderImportedViewport(loadSceneModule);

      const probe = await screen.findByTestId('scene-root-probe');

      expect(probe.dataset.autoCeiling).toBeDefined();
      expect(probe.dataset.changeCount).toBe('2');
    });

    it('has no monitor on a manual level', async () => {
      useSceneSettingsStore.setState({ preference: 'high' });

      renderImportedViewport(loadSceneModule);

      expect((await screen.findByTestId('scene-root-probe')).dataset.autoCeiling).toBeUndefined();
    });

    it('stores a measured level and counts the change', async () => {
      renderImportedViewport(loadSceneModule);

      fireEvent.click(await screen.findByTestId('change-auto-level'));

      expect(useSceneSettingsStore.getState().autoLevel).toBe('low');
      expect(useSceneSettingsStore.getState().autoLevelChangeCount).toBe(1);
    });
  });

  describe('lost WebGL context', () => {
    it('restarts the scene once on a new canvas', async () => {
      renderImportedViewport(loadSceneModule);
      await waitFor(() => {
        expect(getSceneState()).toBe('ready');
      });

      expect(sceneRootControl.mountCount).toBe(1);

      fireEvent.click(screen.getByTestId('lose-context'));

      await waitFor(() => {
        expect(sceneRootControl.mountCount).toBe(2);
      });
      await waitFor(() => {
        expect(getSceneState()).toBe('ready');
      });
      expect(useSceneSettingsStore.getState().isSceneUnavailable).toBe(false);
    });

    it('falls back to the light mode when the context is lost again', async () => {
      renderImportedViewport(loadSceneModule);
      await waitFor(() => {
        expect(getSceneState()).toBe('ready');
      });
      fireEvent.click(screen.getByTestId('lose-context'));
      await waitFor(() => {
        expect(sceneRootControl.mountCount).toBe(2);
      });

      fireEvent.click(await screen.findByTestId('lose-context'));

      await waitFor(() => {
        expect(getSceneState()).toBe('off');
      });
      expect(screen.getByText(NO_WEBGL_MESSAGE)).toBeTruthy();
      expect(useSceneSettingsStore.getState().isSceneUnavailable).toBe(true);
    });
  });

  describe('memory of a failed scene', () => {
    it('remembers a negative probe', () => {
      vi.mocked(isWebGlSupported).mockReturnValue(false);

      renderImportedViewport(loadSceneModule);

      expect(useSceneSettingsStore.getState().isSceneUnavailable).toBe(true);
    });

    it('shows the light mode at once after a render failure, without a probe or a scene request', async () => {
      sceneRootControl.isBroken = true;
      renderImportedViewport(loadSceneModule);
      await waitFor(() => {
        expect(useSceneSettingsStore.getState().isSceneUnavailable).toBe(true);
      });
      cleanup();
      vi.mocked(isWebGlSupported).mockClear();
      sceneRootControl.isBroken = false;
      const loadSceneImport = vi.fn(loadSceneModule);

      renderImportedViewport(loadSceneImport);

      expect(getSceneState()).toBe('off');
      expect(screen.getByText(NO_WEBGL_MESSAGE)).toBeTruthy();
      expect(isWebGlSupported).not.toHaveBeenCalled();
      expect(loadSceneImport).not.toHaveBeenCalled();
    });

    it('tries again after an explicit choice, even of the same level', async () => {
      useSceneSettingsStore.setState({ preference: 'auto' });
      sceneRootControl.isBroken = true;
      renderImportedViewport(loadSceneModule);
      await waitFor(() => {
        expect(getSceneState()).toBe('off');
      });
      sceneRootControl.isBroken = false;

      act(() => {
        useSceneSettingsStore.getState().setPreference('auto');
      });

      await waitFor(() => {
        expect(getSceneState()).toBe('ready');
      });
      expect(useSceneSettingsStore.getState().isSceneUnavailable).toBe(false);
    });

    it('does not remember a failed scene chunk', async () => {
      renderImportedViewport(createFailingThenLoadingScene(1));
      await screen.findByRole('button', { name: RETRY_NAME });

      expect(useSceneSettingsStore.getState().isSceneUnavailable).toBe(false);
    });
  });
});
