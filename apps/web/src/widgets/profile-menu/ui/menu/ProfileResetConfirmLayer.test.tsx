import type { ReactElement } from 'react';

import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';

import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import { FakeMediaQueryList } from '@/shared/theme/index.testing';

const RESET_PROMPT_NAME = defaultLocaleCatalog['demo.reset.confirm.prompt'];
const CANCEL_NAME = defaultLocaleCatalog['demo.reset.confirm.cancel'];
const LAYER_TEST_ID = 'profile-reset-confirm-layer';
const FRAMES_OF_INSTANT_EXIT = 3;
const MOTION_FEATURES_LOADER_PATH = '@/shared/lib/motion/loadMotionFeatures';

interface FeaturesControlValue {
  featuresGate: Promise<void>;
  isFeaturesDelayed: boolean;
  requestedFeatures: Promise<object>[];
}

interface MotionFeaturesLoaderModuleValue {
  loadMotionFeatures: () => Promise<object>;
}

interface RenderedLayerValue {
  onClose: () => void;
  releaseFeatures: () => Promise<void>;
  rerenderLayer: (isShown: boolean) => void;
}

interface RenderLayerOptionsValue {
  isFeaturesDelayed?: boolean | undefined;
  isInitiallyShown: boolean;
  isReducedMotion: boolean;
}

let installedViewport: IFakeViewport | undefined;
let featuresControl: FeaturesControlValue | undefined;

const reducedMotionQuery = new FakeMediaQueryList(false);

const installReducedMotionPreference = (isReduced: boolean): void => {
  const viewportMatchMedia = window.matchMedia.bind(window);

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string): MediaQueryList => (query.includes('prefers-reduced-motion') ? reducedMotionQuery : viewportMatchMedia(query)),
    writable: true,
  });
  reducedMotionQuery.change(isReduced);
};

const renderLayer = async (options: RenderLayerOptionsValue): Promise<RenderedLayerValue> => {
  const { isFeaturesDelayed, isInitiallyShown, isReducedMotion } = options;

  vi.resetModules();
  installedViewport?.restore();
  installedViewport = installFakeViewport('desktop');
  installReducedMotionPreference(isReducedMotion);

  const requestedFeatures: Promise<object>[] = [];
  let releaseDelayedFeatures: () => void = () => undefined;
  const featuresGate = new Promise<void>((resolve) => {
    releaseDelayedFeatures = resolve;
  });

  featuresControl = { featuresGate, isFeaturesDelayed: isFeaturesDelayed === true, requestedFeatures };

  vi.doMock(MOTION_FEATURES_LOADER_PATH, async (importOriginal: () => Promise<MotionFeaturesLoaderModuleValue>) => {
    const actualLoader = await importOriginal();

    return {
      loadMotionFeatures: (): Promise<object> => {
        const control = featuresControl;
        const isDelayed = control?.isFeaturesDelayed === true;
        const bundle = isDelayed ? control.featuresGate.then(actualLoader.loadMotionFeatures) : actualLoader.loadMotionFeatures();

        control?.requestedFeatures.push(bundle);

        return bundle;
      },
    };
  });

  const [
    { createTestRuntime },
    { createMemoryLocation },
    { createThemePreferenceStore },
    { render },
    harness,
    { ProfileResetConfirmLayer },
  ] = await Promise.all([
    import('@/shared/api/index.testing'),
    import('@/shared/routing/index.testing'),
    import('@/shared/theme'),
    import('@testing-library/react'),
    import('../../lib/testing/profileMenuHarness'),
    import('./ProfileResetConfirmLayer'),
  ]);

  const localizer = await harness.createProfileLocalizer();
  const runtime = createTestRuntime({ demoControl: harness.createProfileDemoControl(), routes: harness.createProfileRoutes() });
  runtime.actingContext.set(harness.PROFILE_ACTING_CONTEXT);
  const themeStore = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
  const onClose = vi.fn();

  const toTree = (isShown: boolean): ReactElement => (
    <harness.ProfileTreeProviders
      localizer={localizer}
      location={createMemoryLocation('/network')}
      runtime={runtime}
      themeStore={themeStore}
    >
      <ProfileResetConfirmLayer isShown={isShown} onClose={onClose} />
    </harness.ProfileTreeProviders>
  );

  const rendered = render(toTree(isInitiallyShown));

  if (isFeaturesDelayed !== true) {
    await act(async () => {
      await Promise.all(requestedFeatures);
    });
  }

  return {
    onClose,
    releaseFeatures: async () => {
      releaseDelayedFeatures();
      await act(async () => {
        await Promise.all(requestedFeatures);
      });
    },
    rerenderLayer: (isShown) => {
      rendered.rerender(toTree(isShown));
    },
  };
};

const waitForFrames = async (count: number): Promise<void> => {
  for (let frame = 0; frame < count; frame += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }
};

describe('ProfileResetConfirmLayer', () => {
  afterEach(() => {
    cleanup();
    installedViewport?.restore();
    installedViewport = undefined;
  });

  it('draws nothing while it is not shown', async () => {
    await renderLayer({ isInitiallyShown: false, isReducedMotion: false });

    expect(screen.queryByTestId(LAYER_TEST_ID)).toBeNull();
    expect(screen.queryByRole('group', { name: RESET_PROMPT_NAME })).toBeNull();
  });

  it('shows the confirmation under the button with the focus on cancel', async () => {
    const { rerenderLayer } = await renderLayer({ isInitiallyShown: false, isReducedMotion: false });

    rerenderLayer(true);

    const group = await screen.findByRole('group', { name: RESET_PROMPT_NAME });
    const layer = screen.getByTestId(LAYER_TEST_ID);

    expect(layer.contains(group)).toBe(true);
    expect(layer.hasAttribute('inert')).toBe(false);
    expect(layer.hasAttribute('aria-hidden')).toBe(false);
    await waitFor(() => {
      expect(document.activeElement).toBe(within(group).getByRole('button', { name: CANCEL_NAME }));
    });
  });

  it('starts transparent and shifted down, then settles in place', async () => {
    const { rerenderLayer } = await renderLayer({ isInitiallyShown: false, isReducedMotion: false });

    rerenderLayer(true);
    const layer = await screen.findByTestId(LAYER_TEST_ID);

    expect(Number(layer.style.opacity)).toBeLessThan(1);
    expect(layer.style.transform).toContain('translateY');

    await waitFor(() => {
      expect(layer.style.opacity).toBe('1');
    });
    expect(layer.style.transform).not.toContain('translateY(4px)');
  });

  it('reports the cancel to the owner', async () => {
    const { onClose, rerenderLayer } = await renderLayer({ isInitiallyShown: false, isReducedMotion: false });
    rerenderLayer(true);

    fireEvent.click(await screen.findByRole('button', { name: CANCEL_NAME }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides the fading confirmation from assistive technology and the keyboard at once and removes it after the fade', async () => {
    const { rerenderLayer } = await renderLayer({ isInitiallyShown: true, isReducedMotion: false });
    const layer = await screen.findByTestId(LAYER_TEST_ID);
    await waitFor(() => {
      expect(layer.style.opacity).toBe('1');
    });

    rerenderLayer(false);

    expect(screen.getByTestId(LAYER_TEST_ID)).toBe(layer);
    expect(layer.hasAttribute('inert')).toBe(true);
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(screen.queryByRole('group', { name: RESET_PROMPT_NAME })).toBeNull();

    await waitFor(() => {
      expect(screen.queryByTestId(LAYER_TEST_ID)).toBeNull();
    });
  });

  it('shows the confirmation again after it was hidden', async () => {
    const { rerenderLayer } = await renderLayer({ isInitiallyShown: true, isReducedMotion: false });
    await screen.findByTestId(LAYER_TEST_ID);

    rerenderLayer(false);
    await waitFor(() => {
      expect(screen.queryByTestId(LAYER_TEST_ID)).toBeNull();
    });
    rerenderLayer(true);

    expect(await screen.findByRole('group', { name: RESET_PROMPT_NAME })).toBeDefined();
  });

  describe('while the motion features are still loading', () => {
    it('shows the confirmation at once, settled, with the focus on cancel', async () => {
      const { rerenderLayer } = await renderLayer({ isFeaturesDelayed: true, isInitiallyShown: false, isReducedMotion: false });

      rerenderLayer(true);

      const group = await screen.findByRole('group', { name: RESET_PROMPT_NAME });
      const layer = screen.getByTestId(LAYER_TEST_ID);

      expect(layer.contains(group)).toBe(true);
      expect(layer.style.opacity).toBe('1');
      expect(layer.style.transform).not.toContain('translateY(4px)');
      await waitFor(() => {
        expect(document.activeElement).toBe(within(group).getByRole('button', { name: CANCEL_NAME }));
      });
    });

    it('removes the confirmation within a few frames instead of fading it out', async () => {
      const { rerenderLayer } = await renderLayer({ isFeaturesDelayed: true, isInitiallyShown: true, isReducedMotion: false });
      await screen.findByTestId(LAYER_TEST_ID);

      rerenderLayer(false);
      await waitForFrames(FRAMES_OF_INSTANT_EXIT);

      expect(screen.queryByTestId(LAYER_TEST_ID)).toBeNull();
    });

    it('keeps the shown confirmation and the focus on cancel when the features arrive', async () => {
      const { releaseFeatures, rerenderLayer } = await renderLayer({
        isFeaturesDelayed: true,
        isInitiallyShown: false,
        isReducedMotion: false,
      });
      rerenderLayer(true);
      const layer = await screen.findByTestId(LAYER_TEST_ID);
      const cancel = within(layer).getByRole('button', { name: CANCEL_NAME });
      await waitFor(() => {
        expect(document.activeElement).toBe(cancel);
      });

      await releaseFeatures();

      expect(screen.getByTestId(LAYER_TEST_ID)).toBe(layer);
      expect(within(layer).getByRole('button', { name: CANCEL_NAME })).toBe(cancel);
      expect(document.activeElement).toBe(cancel);
      expect(layer.style.opacity).toBe('1');
    });

    it('fades the confirmation out after the features arrived', async () => {
      const { releaseFeatures, rerenderLayer } = await renderLayer({
        isFeaturesDelayed: true,
        isInitiallyShown: true,
        isReducedMotion: false,
      });
      const layer = await screen.findByTestId(LAYER_TEST_ID);
      await releaseFeatures();

      rerenderLayer(false);

      expect(screen.getByTestId(LAYER_TEST_ID)).toBe(layer);
      expect(layer.hasAttribute('inert')).toBe(true);
      await waitFor(() => {
        expect(screen.queryByTestId(LAYER_TEST_ID)).toBeNull();
      });
    });
  });

  describe('with reduced motion', () => {
    it('shows the confirmation at once, already settled', async () => {
      await renderLayer({ isInitiallyShown: true, isReducedMotion: true });

      const layer = await screen.findByTestId(LAYER_TEST_ID);

      expect(screen.getByRole('group', { name: RESET_PROMPT_NAME })).toBeDefined();
      expect(layer.style.opacity).toBe('1');
      expect(layer.style.transform).not.toContain('translateY(4px)');
    });

    it('removes the confirmation within a few frames instead of fading it out', async () => {
      const { rerenderLayer } = await renderLayer({ isInitiallyShown: true, isReducedMotion: true });
      await screen.findByTestId(LAYER_TEST_ID);

      rerenderLayer(false);
      await waitForFrames(FRAMES_OF_INSTANT_EXIT);

      expect(screen.queryByTestId(LAYER_TEST_ID)).toBeNull();
    });
  });
});
