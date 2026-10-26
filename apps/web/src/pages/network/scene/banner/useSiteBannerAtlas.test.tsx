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

interface HarnessValue {
  atlas: () => ISiteBannerAtlas | undefined;
  invalidate: Mock;
  update: (palette: WorldPaletteValue, entries?: typeof ENTRIES) => void;
}

const ENTRIES = [
  createTestEntry('c1', 'customer', { index: '1', letters: 'Зак' }),
  createTestEntry('s1', 'supplier', { index: '1', letters: 'Пос' }),
];

const PALETTE = readWorldPalette(() => '#808080');

const OTHER_PALETTE: WorldPaletteValue = { ...PALETTE, bannerPlate: { alpha: 1, blue: 10, green: 20, red: 30 } };

const SAME_COLORS_PALETTE: WorldPaletteValue = { ...PALETTE, ground: { alpha: 1, blue: 1, green: 2, red: 3 } };

const renderHarness = async (context: RecordingContextValue): Promise<HarnessValue> => {
  let latest: RootState | undefined;
  let atlas: ISiteBannerAtlas | undefined;
  const invalidate = vi.fn();

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);

  const Probe = ({ entries }: { entries: typeof ENTRIES }): null => {
    const get = useThree(current => current.get);
    const set = useThree(current => current.set);

    atlas = useSiteBannerAtlas(entries);

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

  const result = render(createScene(PALETTE, ENTRIES));

  await waitFor(() => {
    expect(latest).toBeDefined();
  });

  return {
    atlas: (): ISiteBannerAtlas | undefined => atlas,
    invalidate,
    update: (palette, entries = ENTRIES): void => {
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
});
