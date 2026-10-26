import {
  CanvasTexture,
  SRGBColorSpace,
} from 'three';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { SiteBannerAtlasDependenciesValue } from './createSiteBannerAtlas';
import type { RecordingContextValue } from './siteBannerTestSupport';

import { createSiteBannerAtlas } from './createSiteBannerAtlas';
import { createSiteBannerCellLookup } from './createSiteBannerCellLookup';
import { computeSiteBannerAtlasLayout } from './siteBannerAtlasLayout';
import {
  createRecordingContext,
  createTestEntry,
  TEST_BANNER_COLORS,
} from './siteBannerTestSupport';

const ENTRIES = [
  createTestEntry('c1', 'customer', { index: '1', letters: 'Зак' }),
  createTestEntry('c2', 'customer', { index: '2', letters: 'Зак' }),
  createTestEntry('s1', 'supplier', { index: '1', letters: 'Пос' }),
];

interface HarnessValue {
  context: RecordingContextValue;
  dependencies: SiteBannerAtlasDependenciesValue;
  fontState: { isReady: boolean };
  surfaceSizes: [number, number][];
}

const createHarness = (): HarnessValue => {
  const context = createRecordingContext();
  const fontState = { isReady: true };
  const surfaceSizes: [number, number][] = [];

  return {
    context,
    dependencies: {
      createSurface: (width, height) => {
        surfaceSizes.push([width, height]);

        return { canvas: document.createElement('canvas'), context };
      },
      isFontReady: (): boolean => fontState.isReady,
    },
    fontState,
    surfaceSizes,
  };
};

describe('createSiteBannerAtlas', () => {
  it('creates one canvas of the size the layout asks for and draws nothing yet', () => {
    const { context, dependencies, surfaceSizes } = createHarness();

    createSiteBannerAtlas(ENTRIES, 8, dependencies);

    expect(surfaceSizes).toEqual([[2048, 256]]);
    expect(context.calls).toHaveLength(0);
  });

  it('gives a texture in the sRGB color space with the anisotropy of at most 4', () => {
    const { dependencies } = createHarness();
    const atlas = createSiteBannerAtlas(ENTRIES, 16, dependencies);

    expect(atlas.texture).toBeInstanceOf(CanvasTexture);
    expect(atlas.texture.colorSpace).toBe(SRGBColorSpace);
    expect(atlas.texture.anisotropy).toBe(4);
    expect(createSiteBannerAtlas(ENTRIES, 2, createHarness().dependencies).texture.anisotropy).toBe(2);
    expect(createSiteBannerAtlas(ENTRIES, 0, createHarness().dependencies).texture.anisotropy).toBe(1);
  });

  it('draws the whole canvas once on the first redraw and uploads the texture', () => {
    const { context, dependencies } = createHarness();
    const atlas = createSiteBannerAtlas(ENTRIES, 4, dependencies);
    const versionBefore = atlas.texture.version;

    expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(true);
    expect(context.countOf('clearRect')).toBe(1);
    expect(context.countOf('roundRect')).toBe(ENTRIES.length + 3);
    expect(atlas.texture.version).toBe(versionBefore + 1);
  });

  it('does not touch the canvas again for the same colors', () => {
    const { context, dependencies } = createHarness();
    const atlas = createSiteBannerAtlas(ENTRIES, 4, dependencies);

    atlas.redraw(TEST_BANNER_COLORS);

    const callsAfterFirst = context.calls.length;
    const versionAfterFirst = atlas.texture.version;

    expect(atlas.redraw({ ...TEST_BANNER_COLORS })).toBe(false);
    expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(false);
    expect(context.calls).toHaveLength(callsAfterFirst);
    expect(atlas.texture.version).toBe(versionAfterFirst);
  });

  it('redraws the whole canvas once for new colors', () => {
    const { context, dependencies } = createHarness();
    const atlas = createSiteBannerAtlas(ENTRIES, 4, dependencies);

    atlas.redraw(TEST_BANNER_COLORS);

    const callsAfterFirst = context.calls.length;
    const versionAfterFirst = atlas.texture.version;

    expect(atlas.redraw({ ...TEST_BANNER_COLORS, plate: 'rgb(9, 9, 9)' })).toBe(true);
    expect(context.countOf('clearRect')).toBe(2);
    expect(context.calls.length).toBe(callsAfterFirst * 2);
    expect(atlas.texture.version).toBe(versionAfterFirst + 1);
    expect(atlas.redraw({ ...TEST_BANNER_COLORS, plate: 'rgb(9, 9, 9)' })).toBe(false);
  });

  it('redraws once more when the fonts become ready after a draw with the fallback', () => {
    const { context, dependencies, fontState } = createHarness();
    const atlas = createSiteBannerAtlas(ENTRIES, 4, dependencies);

    fontState.isReady = false;

    expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(true);
    expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(false);

    fontState.isReady = true;

    expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(true);
    expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(false);
    expect(context.countOf('clearRect')).toBe(2);
  });

  it('answers the cell lookups of the layout', () => {
    const { dependencies } = createHarness();
    const atlas = createSiteBannerAtlas(ENTRIES, 4, dependencies);
    const lookup = createSiteBannerCellLookup(computeSiteBannerAtlasLayout(ENTRIES.length), ENTRIES);

    expect(atlas.getNearCell('c2', 'customer')).toEqual(lookup.getNearCell('c2', 'customer'));
    expect(atlas.getFarCell('supplier')).toEqual(lookup.getFarCell('supplier'));
  });

  it('disposes the texture', () => {
    const { dependencies } = createHarness();
    const atlas = createSiteBannerAtlas(ENTRIES, 4, dependencies);
    const handleDispose = vi.fn();

    atlas.texture.addEventListener('dispose', handleDispose);
    atlas.dispose();

    expect(handleDispose).toHaveBeenCalledTimes(1);
  });
});
