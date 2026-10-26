import type { RootState } from '@react-three/fiber';
import type { ReactElement } from 'react';
import type { Mock } from 'vitest';

import {
  Canvas,
  useThree,
} from '@react-three/fiber';
import {
  act,
  cleanup,
  render,
  waitFor,
} from '@testing-library/react';
import { useEffect } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { WorldPaletteValue } from '@/shared/3d';

import {
  readWorldPalette,
  WorldMaterialsProvider,
} from '@/shared/3d';

import type { ISiteBannerAtlas } from './createSiteBannerAtlas';
import type {
  ISiteBannerLogoLoader,
  SiteBannerLogoImageValue,
} from './siteBannerLogos';
import type { RecordingContextValue } from './siteBannerTestSupport';

import {
  createFakeRenderer,
  ImmediateResizeObserver,
  VIEWPORT_RECT,
} from '../layers/canvasTestSupport';
import {
  createRecordingContext,
  createTestEntry,
} from './siteBannerTestSupport';
import { useSiteBannerAtlas } from './useSiteBannerAtlas';

interface FakeLogoLoaderValue extends ISiteBannerLogoLoader {
  fail: () => Promise<void>;
  loadMock: Mock<(paths: readonly string[]) => Promise<void>>;
  readRequestedPaths: () => string[];
  release: () => Promise<void>;
}

interface HarnessOptionsValue {
  entries?: typeof ENTRIES;
  logoLoader?: ISiteBannerLogoLoader;
}

interface HarnessValue {
  atlas: () => ISiteBannerAtlas | undefined;
  invalidate: Mock;
  update: (palette: WorldPaletteValue, entries?: typeof ENTRIES) => void;
}

const ENTRIES = [
  createTestEntry('c1', 'customer', { index: '1', letters: 'Зак' }),
  createTestEntry('s1', 'supplier', { index: '1', letters: 'Пос' }),
];

const LOGO_ENTRIES = [
  createTestEntry('c1', 'customer', { index: '1', letters: 'Зак' }, 'logos/c1.svg'),
  createTestEntry('s1', 'supplier', { index: '1', letters: 'Пос' }, 'logos/s1.svg'),
];

const createLogoImage = (): SiteBannerLogoImageValue => ({
  height: 76,
  image: { close: () => undefined } as unknown as CanvasImageSource,
  width: 124,
});

const createFakeLogoLoader = (readyPaths: readonly string[] = []): FakeLogoLoaderValue => {
  const logos = new Map(readyPaths.map((path): [string, SiteBannerLogoImageValue] => [path, createLogoImage()]));
  const pending: { paths: readonly string[]; resolve: () => void }[] = [];
  const loadMock = vi.fn((paths: readonly string[]): Promise<void> => new Promise<void>((resolve) => {
    pending.push({ paths, resolve });
  }));

  const settle = async (isLoaded: boolean): Promise<void> => {
    for (const { paths, resolve } of pending.splice(0)) {
      if (isLoaded) {
        for (const path of paths) {
          logos.set(path, createLogoImage());
        }
      }

      resolve();
    }

    await Promise.resolve();
  };

  return {
    fail: async (): Promise<void> => { await settle(false); },
    load: loadMock,
    loadMock,
    peek: (path): SiteBannerLogoImageValue | undefined => logos.get(path),
    readRequestedPaths: (): string[] => [...new Set(loadMock.mock.calls.flatMap(call => call[0]))].toSorted(),
    release: async (): Promise<void> => { await settle(true); },
  };
};

const PALETTE = readWorldPalette(() => '#808080');

const OTHER_PALETTE: WorldPaletteValue = { ...PALETTE, bannerPlate: { alpha: 1, blue: 10, green: 20, red: 30 } };

const SAME_COLORS_PALETTE: WorldPaletteValue = { ...PALETTE, ground: { alpha: 1, blue: 1, green: 2, red: 3 } };

const renderHarness = async (
  context: RecordingContextValue,
  options: HarnessOptionsValue = {},
): Promise<HarnessValue> => {
  const initialEntries = options.entries ?? ENTRIES;
  let latest: RootState | undefined;
  let atlas: ISiteBannerAtlas | undefined;
  const invalidate = vi.fn();

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);

  const Probe = ({ entries }: { entries: typeof ENTRIES }): null => {
    const get = useThree(current => current.get);
    const set = useThree(current => current.set);

    atlas = useSiteBannerAtlas(entries, options.logoLoader);

    useEffect(() => {
      set({ invalidate });
      latest = get();
    }, [get, set]);

    return null;
  };

  const createScene = (palette: WorldPaletteValue, entries: typeof ENTRIES): ReactElement => (
    <Canvas
      frameloop="never"
      gl={(defaultProps): never => ({
        ...createFakeRenderer(defaultProps.canvas),
        capabilities: { getMaxAnisotropy: (): number => 8 },
      }) as never}
      orthographic
    >
      <WorldMaterialsProvider palette={palette}>
        <Probe entries={entries} />
      </WorldMaterialsProvider>
    </Canvas>
  );

  const result = render(createScene(PALETTE, initialEntries));

  await waitFor(() => {
    expect(latest).toBeDefined();
  });

  return {
    atlas: (): ISiteBannerAtlas | undefined => atlas,
    invalidate,
    update: (palette, entries = initialEntries): void => {
      act(() => {
        result.rerender(createScene(palette, entries));
      });
    },
  };
};

describe('useSiteBannerAtlas', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ImmediateResizeObserver);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(VIEWPORT_RECT);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, 'fonts');
  });

  it('draws the atlas once when it mounts and gives it to the caller', async () => {
    const context = createRecordingContext();
    const { atlas } = await renderHarness(context);

    expect(atlas()).toBeDefined();
    expect(context.countOf('clearRect')).toBe(1);
    expect(context.countOf('roundRect')).toBe(ENTRIES.length + 3);
    expect(atlas()?.texture.anisotropy).toBe(4);
  });

  it('draws nothing and gives no atlas while there are no organizations', async () => {
    const context = createRecordingContext();
    const harness = await renderHarness(context);

    harness.update(PALETTE, []);

    expect(harness.atlas()).toBeUndefined();
    expect(context.countOf('clearRect')).toBe(1);
  });

  it('does not redraw when the theme gives a new palette object with the same colors', async () => {
    const context = createRecordingContext();
    const { atlas, update } = await renderHarness(context);
    const first = atlas();

    update(readWorldPalette(() => '#808080'));
    update(SAME_COLORS_PALETTE);

    expect(context.countOf('clearRect')).toBe(1);
    expect(atlas()).toBe(first);
  });

  it('redraws once and asks for one more frame when the colors of the banners change', async () => {
    const context = createRecordingContext();
    const { atlas, invalidate, update } = await renderHarness(context);
    const first = atlas();

    invalidate.mockClear();
    update(SAME_COLORS_PALETTE);

    const callsForSameColors = invalidate.mock.calls.length;

    invalidate.mockClear();
    update(OTHER_PALETTE);

    expect(context.countOf('clearRect')).toBe(2);
    expect(invalidate.mock.calls.length).toBe(callsForSameColors + 1);
    expect(atlas()).toBe(first);

    update(OTHER_PALETTE);

    expect(context.countOf('clearRect')).toBe(2);
  });

  it('makes a new atlas and frees the old texture when the organizations change', async () => {
    const context = createRecordingContext();
    const { atlas, update } = await renderHarness(context);
    const first = atlas();
    const handleDispose = vi.fn();

    first?.texture.addEventListener('dispose', handleDispose);
    update(PALETTE, [ENTRIES[0] ?? createTestEntry('x', 'customer', { index: '', letters: '' })]);

    expect(atlas()).not.toBe(first);
    expect(handleDispose).toHaveBeenCalledTimes(1);
    expect(context.countOf('clearRect')).toBe(2);
  });

  it('frees the texture when the scene goes away', async () => {
    const context = createRecordingContext();
    const { atlas } = await renderHarness(context);
    const handleDispose = vi.fn();

    atlas()?.texture.addEventListener('dispose', handleDispose);
    cleanup();

    expect(handleDispose).toHaveBeenCalledTimes(1);
  });

  it('redraws once more after the fonts load when the first draw had to use the fallback', async () => {
    const fontState = { isReady: false };

    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        check: (): boolean => fontState.isReady,
        load: (): Promise<void> => {
          fontState.isReady = true;

          return Promise.resolve();
        },
      },
    });

    const context = createRecordingContext();
    const { invalidate } = await renderHarness(context);

    await waitFor(() => {
      expect(context.countOf('clearRect')).toBe(2);
    });

    expect(invalidate).toHaveBeenCalled();
  });

  describe('with logos', () => {
    const LOGO_PATHS = ['logos/c1.svg', 'logos/s1.svg'];

    it('draws the logos that were ready before the mount in the one first draw and loads nothing', async () => {
      const context = createRecordingContext();
      const logoLoader = createFakeLogoLoader(LOGO_PATHS);

      await renderHarness(context, { entries: LOGO_ENTRIES, logoLoader });

      expect(context.countOf('clearRect')).toBe(1);
      expect(context.countOf('drawImage')).toBe(2);
      expect(context.countOf('fillText')).toBe(0);
      expect(logoLoader.loadMock).not.toHaveBeenCalled();
    });

    it('asks for the logos that are not ready and redraws once with one more frame when they come', async () => {
      const context = createRecordingContext();
      const logoLoader = createFakeLogoLoader(['logos/c1.svg']);
      const { invalidate } = await renderHarness(context, { entries: LOGO_ENTRIES, logoLoader });

      expect(logoLoader.readRequestedPaths()).toEqual(['logos/s1.svg']);
      expect(context.countOf('clearRect')).toBe(1);

      const invalidatesBefore = invalidate.mock.calls.length;

      await act(async () => {
        await logoLoader.release();
      });

      await waitFor(() => {
        expect(context.countOf('clearRect')).toBe(2);
      });

      expect(invalidate.mock.calls.length).toBe(invalidatesBefore + 1);
      expect(context.calls.filter(call => call.op === 'drawImage')).toHaveLength(1 + 2);
    });

    it('does not redraw and does not ask for a frame when the logos fail to load', async () => {
      const context = createRecordingContext();
      const logoLoader = createFakeLogoLoader();
      const { invalidate } = await renderHarness(context, { entries: LOGO_ENTRIES, logoLoader });
      const invalidatesBefore = invalidate.mock.calls.length;

      expect(logoLoader.readRequestedPaths()).toEqual(LOGO_PATHS);

      await act(async () => {
        await logoLoader.fail();
      });

      expect(context.countOf('clearRect')).toBe(1);
      expect(context.countOf('fillText')).toBe(4);
      expect(invalidate.mock.calls.length).toBe(invalidatesBefore);
    });

    it('does not redraw for a theme that gives the same colors of the banners', async () => {
      const context = createRecordingContext();
      const logoLoader = createFakeLogoLoader(LOGO_PATHS);
      const { update } = await renderHarness(context, { entries: LOGO_ENTRIES, logoLoader });

      update(readWorldPalette(() => '#808080'));
      update(SAME_COLORS_PALETTE);

      expect(context.countOf('clearRect')).toBe(1);
      expect(logoLoader.loadMock).not.toHaveBeenCalled();
    });

    it('drops the wait for the logos when the atlas is replaced', async () => {
      const context = createRecordingContext();
      const logoLoader = createFakeLogoLoader();
      const { atlas, invalidate, update } = await renderHarness(context, { entries: LOGO_ENTRIES, logoLoader });
      const first = atlas();
      const versionBefore = first?.texture.version;

      update(PALETTE, ENTRIES);

      const invalidatesBefore = invalidate.mock.calls.length;
      const clearsBefore = context.countOf('clearRect');

      await act(async () => {
        await logoLoader.release();
      });

      expect(atlas()).not.toBe(first);
      expect(first?.texture.version).toBe(versionBefore);
      expect(context.countOf('clearRect')).toBe(clearsBefore);
      expect(invalidate.mock.calls.length).toBe(invalidatesBefore);
    });
  });
});
