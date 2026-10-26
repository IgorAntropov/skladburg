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
import type { SiteBannerLogoImageValue } from './siteBannerLogos';
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

const LOGO_ENTRIES = [
  createTestEntry('c1', 'customer', { index: '1', letters: 'Зак' }, 'logos/c1.svg'),
  createTestEntry('c2', 'customer', { index: '2', letters: 'Зак' }, 'logos/c2.svg'),
  createTestEntry('s1', 'supplier', { index: '1', letters: 'Пос' }, 'logos/c1.svg'),
];

const createLogoImage = (): SiteBannerLogoImageValue => ({
  height: 76,
  image: { close: () => undefined } as unknown as CanvasImageSource,
  width: 124,
});

interface HarnessValue {
  canvases: HTMLCanvasElement[];
  context: RecordingContextValue;
  dependencies: SiteBannerAtlasDependenciesValue;
  fontState: { isReady: boolean };
  logos: Map<string, SiteBannerLogoImageValue>;
  replacementContext: RecordingContextValue;
  surfaceSizes: [number, number][];
}

const createHarness = (): HarnessValue => {
  const context = createRecordingContext();
  const replacementContext = createRecordingContext();
  const fontState = { isReady: true };
  const logos = new Map<string, SiteBannerLogoImageValue>();
  const surfaceSizes: [number, number][] = [];
  const canvases: HTMLCanvasElement[] = [];

  return {
    canvases,
    context,
    dependencies: {
      createSurface: (width, height) => {
        surfaceSizes.push([width, height]);

        const canvas = document.createElement('canvas');

        canvases.push(canvas);

        return { canvas, context: canvases.length === 1 ? context : replacementContext };
      },
      isFontReady: (): boolean => fontState.isReady,
      peekLogo: (path): SiteBannerLogoImageValue | undefined => logos.get(path),
    },
    fontState,
    logos,
    replacementContext,
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

  describe('with logos', () => {
    it('draws the ready logos once and checks that the canvas can be read', () => {
      const { context, dependencies, logos } = createHarness();
      const atlas = createSiteBannerAtlas(LOGO_ENTRIES, 4, dependencies);

      logos.set('logos/c1.svg', createLogoImage());

      expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(true);
      expect(context.countOf('drawImage')).toBe(2);
      expect(context.countOf('fillText')).toBe(2);

      const readbacks = context.calls.filter(call => call.op === 'getImageData');

      expect(readbacks.map(call => call.args)).toEqual([[0, 0, 1, 1]]);
      expect(context.calls.findIndex(call => call.op === 'getImageData')).toBe(context.calls.length - 1);
    });

    it('does not read the canvas when no logo is ready', () => {
      const { context, dependencies } = createHarness();
      const atlas = createSiteBannerAtlas(LOGO_ENTRIES, 4, dependencies);

      atlas.redraw(TEST_BANNER_COLORS);

      expect(context.countOf('getImageData')).toBe(0);
      expect(context.countOf('drawImage')).toBe(0);
      expect(context.countOf('fillText')).toBe(6);
    });

    it('does not redraw for the same set of ready logos and redraws once for each new one', () => {
      const { context, dependencies, logos } = createHarness();
      const atlas = createSiteBannerAtlas(LOGO_ENTRIES, 4, dependencies);

      logos.set('logos/c1.svg', createLogoImage());

      expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(true);
      expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(false);
      expect(atlas.redraw({ ...TEST_BANNER_COLORS })).toBe(false);
      expect(context.countOf('clearRect')).toBe(1);

      logos.set('logos/c2.svg', createLogoImage());

      expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(true);
      expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(false);
      expect(context.countOf('clearRect')).toBe(2);
    });

    it('redraws once more for a logo that comes after a draw with monograms', () => {
      const { context, dependencies, logos } = createHarness();
      const atlas = createSiteBannerAtlas(LOGO_ENTRIES, 4, dependencies);
      const versionBefore = atlas.texture.version;

      atlas.redraw(TEST_BANNER_COLORS);
      logos.set('logos/c2.svg', createLogoImage());

      expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(true);
      expect(context.countOf('drawImage')).toBe(1);
      expect(atlas.texture.version).toBe(versionBefore + 2);
    });

    it('ignores a logo that does not belong to any organization of the atlas', () => {
      const { context, dependencies, logos } = createHarness();
      const atlas = createSiteBannerAtlas(LOGO_ENTRIES, 4, dependencies);

      atlas.redraw(TEST_BANNER_COLORS);
      logos.set('logos/other.svg', createLogoImage());

      expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(false);
      expect(context.countOf('clearRect')).toBe(1);
    });

    it('keeps the canvas of the texture when it can be read', () => {
      const { canvases, dependencies, logos } = createHarness();
      const atlas = createSiteBannerAtlas(LOGO_ENTRIES, 4, dependencies);
      const { image } = atlas.texture;

      logos.set('logos/c1.svg', createLogoImage());
      atlas.redraw(TEST_BANNER_COLORS);

      expect(canvases).toHaveLength(1);
      expect(atlas.texture.image).toBe(image);
    });

    describe('when the canvas turns out to be unreadable', () => {
      const createBlockedAtlas = (): ReturnType<typeof createHarness> & {
        atlas: ReturnType<typeof createSiteBannerAtlas>;
      } => {
        const harness = createHarness();
        const atlas = createSiteBannerAtlas(LOGO_ENTRIES, 4, harness.dependencies);

        harness.context.isReadbackBlocked = true;
        harness.logos.set('logos/c1.svg', createLogoImage());
        harness.logos.set('logos/c2.svg', createLogoImage());
        vi.spyOn(console, 'log').mockImplementation(() => undefined);

        return { ...harness, atlas };
      };

      it('draws the monograms on a clean canvas, gives it to the texture and writes a log', () => {
        const { atlas, canvases, context, replacementContext } = createBlockedAtlas();
        const versionBefore = atlas.texture.version;

        expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(true);
        expect(canvases).toHaveLength(2);
        expect(atlas.texture.image).toBe(canvases[1]);
        expect(atlas.texture.version).toBe(versionBefore + 1);
        expect(context.countOf('drawImage')).toBe(3);
        expect(replacementContext.countOf('drawImage')).toBe(0);
        expect(replacementContext.countOf('clearRect')).toBe(1);
        expect(replacementContext.countOf('fillText')).toBe(6);
        expect(replacementContext.countOf('roundRect')).toBe(LOGO_ENTRIES.length + 3);
        expect(vi.mocked(console.log)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(console.log).mock.calls[0]?.[0]).toBe('> SiteBannerAtlas -> redraw:');
        expect(vi.mocked(console.log).mock.calls[0]?.[1]).toMatchObject({ error: { name: 'SecurityError' } });
      });

      it('takes no logos in the redraws that follow, for the same colors and for new ones', () => {
        const {
          atlas,
          logos,
          replacementContext,
        } = createBlockedAtlas();

        atlas.redraw(TEST_BANNER_COLORS);

        expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(false);

        logos.set('logos/other.svg', createLogoImage());

        expect(atlas.redraw(TEST_BANNER_COLORS)).toBe(false);
        expect(atlas.redraw({ ...TEST_BANNER_COLORS, plate: 'rgb(9, 9, 9)' })).toBe(true);
        expect(replacementContext.countOf('drawImage')).toBe(0);
        expect(replacementContext.countOf('getImageData')).toBe(0);
        expect(replacementContext.countOf('clearRect')).toBe(2);
      });
    });
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
