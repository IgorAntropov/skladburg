import type {
  ComponentType,
  ReactElement,
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

import type { CachedModuleLoader } from '@/shared/lib/module-loader';
import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';

import { useSceneSettingsStore } from '@/features/scene-settings';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { createCachedModuleLoader } from '@/shared/lib/module-loader';
import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import { RoutingProvider } from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import type { SceneModuleValue } from '../model/sceneViewportTypes';

import { loadSceneRoot } from '../lib/loadSceneRoot';
import { isWebGlSupported } from '../lib/webGlSupport';
import { SceneViewport } from './SceneViewport';

const sceneRootControl = vi.hoisted(() => ({ isBroken: false }));

vi.mock('../lib/webGlSupport', () => ({ isWebGlSupported: vi.fn(() => true) }));

vi.mock('../scene/SceneRoot', () => {
  const SceneRoot = ({ Content, onReady }: { Content: ComponentType; onReady: () => void }): ReactElement => {
    if (sceneRootControl.isBroken) {
      throw new Error('the WebGL context was not created');
    }

    useEffect(() => {
      onReady();
    }, [onReady]);

    return (
      <div data-testid="scene-root-probe">
        <Content />
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

const SCENE_BOUNDS = { maxX: 1, maxZ: 1, minX: -1, minZ: -1 };
const SCENE_VIEW_BOX = {
  maxX: 1,
  maxY: 1,
  maxZ: 1,
  minX: -1,
  minY: -1,
  minZ: -1,
};

const SceneContent = (): ReactElement => <span data-testid="scene-content" />;

const loadSceneModule = (): Promise<SceneModuleValue> => Promise.resolve({
  bounds: SCENE_BOUNDS,
  default: SceneContent,
  viewBox: SCENE_VIEW_BOX,
});

const createFailingThenLoadingScene = (failureCount: number): Mock<() => Promise<SceneModuleValue>> => {
  let failedCount = 0;

  return vi.fn(() => {
    if (failedCount < failureCount) {
      failedCount += 1;

      return Promise.reject(new Error('the scene chunk is unavailable'));
    }

    return loadSceneModule();
  });
};

let installedViewport: IFakeViewport | undefined;
let memoryLocation: IMemoryLocation;

const renderViewport = (loadScene: CachedModuleLoader<SceneModuleValue>): void => {
  render(withTestLocalizer(
    <RoutingProvider location={memoryLocation}>
      <SceneViewport label={LABEL} loadScene={loadScene} />
    </RoutingProvider>,
  ));
};

const renderImportedViewport = (loadSceneImport: () => Promise<SceneModuleValue>): void => {
  renderViewport(createCachedModuleLoader(loadSceneImport));
};

const getSceneState = (): null | string => screen.getByTestId('scene-viewport').getAttribute(SCENE_STATE_ATTRIBUTE);

describe('SceneViewport', () => {
  beforeEach(() => {
    installedViewport = installFakeViewport('desktop');
    memoryLocation = createMemoryLocation('/network');
    useSceneSettingsStore.setState({ autoLevel: undefined, isSceneUnavailable: false, preference: undefined });
    vi.mocked(isWebGlSupported).mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sceneRootControl.isBroken = false;
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
      expect(screen.getByTestId('scene-content')).toBeTruthy();
    });

    it('mounts an already loaded scene on the first render', async () => {
      const loadScene = createCachedModuleLoader(loadSceneModule);
      await Promise.all([loadScene(), loadSceneRoot()]);

      renderViewport(loadScene);

      expect(screen.getByTestId('scene-root-probe')).toBeTruthy();
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
