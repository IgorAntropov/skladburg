import {
  describe,
  expect,
  it,
} from 'vitest';

import { SIDE_SHAPES } from '@/entities/organization';

import type { SiteBannerEntryValue } from './siteBannerEntry';
import type { SiteBannerLogoImageValue } from './siteBannerLogos';

import { drawSiteBannerAtlas } from './drawSiteBannerAtlas';
import {
  computeSiteBannerAtlasLayout,
  readFarCellPixels,
  readNearCellPixels,
} from './siteBannerAtlasLayout';
import {
  createRecordingContext,
  createTestEntry,
  TEST_BANNER_COLORS,
} from './siteBannerTestSupport';

const COLORS = TEST_BANNER_COLORS;

const ENTRIES: readonly SiteBannerEntryValue[] = [
  createTestEntry('c1', 'customer', { index: '1', letters: 'Зак' }),
  createTestEntry('s1', 'supplier', { index: '1', letters: 'Пос' }),
  createTestEntry('s2', 'supplier', { index: '', letters: 'СП' }),
  createTestEntry('p1', 'carrier', { index: '7', letters: '' }),
];

const createLogoImage = (width: number, height: number): SiteBannerLogoImageValue => ({
  height,
  image: { close: () => undefined } as unknown as CanvasImageSource,
  width,
});

const drawEntries = (
  entries: readonly SiteBannerEntryValue[],
  logos: ReadonlyMap<string, SiteBannerLogoImageValue> = new Map(),
): ReturnType<typeof createRecordingContext> => {
  const context = createRecordingContext();

  drawSiteBannerAtlas(context, computeSiteBannerAtlasLayout(entries.length), entries, COLORS, path => logos.get(path));

  return context;
};

describe('drawSiteBannerAtlas', () => {
  it('clears the whole canvas once before drawing', () => {
    const context = drawEntries(ENTRIES);
    const layout = computeSiteBannerAtlasLayout(ENTRIES.length);

    expect(context.calls[0]).toMatchObject({ args: [0, 0, layout.width, layout.height], op: 'clearRect' });
    expect(context.countOf('clearRect')).toBe(1);
  });

  it('draws one plate and one frame for each organization and each shared side cell', () => {
    const context = drawEntries(ENTRIES);
    const plates = context.calls.filter(call => call.op === 'roundRect');
    const layout = computeSiteBannerAtlasLayout(ENTRIES.length);

    expect(plates).toHaveLength(ENTRIES.length + 3);

    const firstCell = readNearCellPixels(layout, 0);

    expect(plates.map(call => call.args)).toContainEqual([firstCell.x + 6, firstCell.y + 6, 244, 116, 18]);

    const plateFills = context.calls.filter(call => call.op === 'fill' && call.fillStyle === COLORS.plate);
    const frameStrokes = context.calls.filter(call => call.op === 'stroke' && call.strokeStyle !== COLORS.rim);

    expect(plateFills).toHaveLength(ENTRIES.length + 3);
    expect(frameStrokes).toHaveLength(ENTRIES.length + 3);
    expect(frameStrokes.filter(call => call.strokeStyle === COLORS.supplier)).toHaveLength(3);
    expect(frameStrokes.filter(call => call.strokeStyle === COLORS.customer)).toHaveLength(2);
    expect(frameStrokes.filter(call => call.strokeStyle === COLORS.carrier)).toHaveLength(2);
  });

  it('draws the shape of the side as a glyph in every banner cell and as a flag in each far cell', () => {
    const context = drawEntries(ENTRIES);

    expect(context.countOf('closePath')).toBe(3 + 3 + ENTRIES.length);

    const customerFlag = readFarCellPixels('customer');
    const firstPoint = SIDE_SHAPES.customer.outline[0] ?? [0, 0];

    expect(context.calls.filter(call => call.op === 'moveTo').map(call => call.args)).toContainEqual([
      customerFlag.x + 6 + firstPoint[0] * 52,
      customerFlag.y + 6 + firstPoint[1] * 52,
    ]);
  });

  it('paints the glyph with the rim around it and the color of the side inside', () => {
    const context = drawEntries(ENTRIES.slice(0, 1));
    const rimWidths = context.calls
      .filter(call => call.op === 'stroke' && call.strokeStyle === COLORS.rim)
      .map(call => call.lineWidth);
    const glyphFills = context.calls.filter(call => call.op === 'fill' && call.fillStyle === COLORS.customer);

    expect(rimWidths.toSorted((current, prev) => current - prev)).toEqual([6, 6, 6, 6, 10, 10, 10]);
    expect(glyphFills).toHaveLength(3);

    const rimIndex = context.calls.findIndex(call => call.op === 'stroke' && call.strokeStyle === COLORS.rim);

    expect(context.calls[rimIndex + 1]).toMatchObject({ fillStyle: COLORS.customer, op: 'fill' });
  });

  it('sets the text in two runs, the letters in 800 and the index in 600, on one baseline', () => {
    const context = drawEntries(ENTRIES.slice(0, 1));
    const texts = context.calls.filter(call => call.op === 'fillText');

    expect(texts).toHaveLength(2);
    expect(texts[0]?.args[0]).toBe('Зак');
    expect(texts[0]?.font.startsWith('800 54px Manrope')).toBe(true);
    expect(texts[1]?.args[0]).toBe('1');
    expect(texts[1]?.font.startsWith('600 32.4px Manrope')).toBe(true);
    expect(texts[0]?.args[2]).toBe(texts[1]?.args[2]);
    expect(texts[0]?.fillStyle).toBe(COLORS.text);
    expect(texts[1]?.fillStyle).toBe(COLORS.text);
  });

  it('puts the text block in the middle of the plate and the index after the letters with the gap', () => {
    const context = drawEntries(ENTRIES.slice(0, 1));
    const layout = computeSiteBannerAtlasLayout(1);
    const cell = readNearCellPixels(layout, 0);
    const [letters, index] = context.calls.filter(call => call.op === 'fillText');
    const lettersWidth = 'Зак'.length * 54 * 0.6;
    const indexWidth = 32.4 * 0.6;
    const total = lettersWidth + 4.32 + indexWidth;
    const lettersX = Number(letters?.args[1]);
    const indexX = Number(index?.args[1]);

    expect(lettersX).toBeCloseTo(cell.x + 128 - total / 2, 6);
    expect(indexX).toBeCloseTo(lettersX + lettersWidth + 4.32, 6);
  });

  it('sets one run for the letters alone and one for the index alone', () => {
    const context = drawEntries(ENTRIES.slice(2));
    const texts = context.calls.filter(call => call.op === 'fillText');

    expect(texts.map(call => call.args[0])).toEqual(['СП', '7']);
    expect(texts[1]?.font.startsWith('800 ')).toBe(true);
  });

  it('draws a circle of the side color and no text for an empty monogram', () => {
    const entries = [createTestEntry('x', 'supplier', { index: '', letters: '' })];
    const context = drawEntries(entries);
    const layout = computeSiteBannerAtlasLayout(1);
    const cell = readNearCellPixels(layout, 0);

    expect(context.countOf('fillText')).toBe(0);
    expect(context.countOf('arc')).toBe(1);
    expect(context.calls.find(call => call.op === 'arc')?.args).toEqual([cell.x + 128, cell.y + 66, 16, 0, Math.PI * 2]);

    const circleFill = context.calls.findIndex(call => call.op === 'arc') + 1;

    expect(context.calls[circleFill]).toMatchObject({ fillStyle: COLORS.supplier, op: 'fill' });
  });

  it('draws no text and no circle in the shared cells of the sides', () => {
    const context = drawEntries([]);

    expect(context.countOf('fillText')).toBe(0);
    expect(context.countOf('arc')).toBe(0);
    expect(context.countOf('roundRect')).toBe(3);
    expect(context.countOf('closePath')).toBe(6);
  });

  it('draws only the organizations the atlas has room for', () => {
    const entries = Array.from({ length: 60 }, (_, index) => createTestEntry(
      `o${String(index).padStart(2, '0')}`,
      'customer',
      { index: String(index), letters: 'Орг' },
    ));
    const context = drawEntries(entries);

    expect(context.countOf('roundRect')).toBe(53 + 3);
    expect(context.countOf('fillText')).toBe(53 * 2);
  });

  describe('with logos', () => {
    const LOGO_ENTRIES: readonly SiteBannerEntryValue[] = [
      createTestEntry('c1', 'customer', { index: '1', letters: 'Зак' }, 'logos/c1.svg'),
      createTestEntry('s1', 'supplier', { index: '1', letters: 'Пос' }, 'logos/s1.svg'),
      createTestEntry('s2', 'supplier', { index: '2', letters: 'Пос' }, 'logos/s2.svg'),
    ];

    it('draws the picture once into the logo field of the cell and no monogram for an organization with a ready logo', () => {
      const image = createLogoImage(124, 76);
      const context = drawEntries(LOGO_ENTRIES.slice(0, 1), new Map([['logos/c1.svg', image]]));
      const cell = readNearCellPixels(computeSiteBannerAtlasLayout(1), 0);

      expect(context.countOf('drawImage')).toBe(1);
      expect(context.drawnImages).toEqual([image.image]);
      expect(context.calls.find(call => call.op === 'drawImage')?.args).toEqual([cell.x + 60, cell.y + 30, 124, 76]);
      expect(context.countOf('fillText')).toBe(0);
      expect(context.countOf('arc')).toBe(0);
    });

    it('keeps the frame and the glyph of the side for an organization with a logo', () => {
      const withLogo = drawEntries(LOGO_ENTRIES.slice(0, 1), new Map([['logos/c1.svg', createLogoImage(124, 76)]]));
      const withMonogram = drawEntries(LOGO_ENTRIES.slice(0, 1));

      for (const op of ['roundRect', 'closePath', 'moveTo', 'lineTo', 'stroke']) {
        expect(withLogo.countOf(op)).toBe(withMonogram.countOf(op));
      }

      expect(withLogo.countOf('roundRect')).toBe(1 + 3);
      expect(withLogo.calls.filter(call => call.op === 'stroke' && call.strokeStyle === COLORS.customer)).toHaveLength(2);
      expect(withLogo.calls.filter(call => call.op === 'fill' && call.fillStyle === COLORS.customer)).toHaveLength(3);
    });

    it('draws one picture for each organization whose logo is ready and the monogram for the others', () => {
      const logos = new Map([
        ['logos/c1.svg', createLogoImage(124, 76)],
        ['logos/s2.svg', createLogoImage(140, 76)],
      ]);
      const context = drawEntries(LOGO_ENTRIES, logos);

      expect(context.countOf('drawImage')).toBe(2);
      expect(context.calls.filter(call => call.op === 'fillText').map(call => call.args[0])).toEqual(['Пос', '1']);
    });

    it('draws the monogram when the logo is not ready or the entry has no path', () => {
      const entries = [
        createTestEntry('a', 'customer', { index: '1', letters: 'Зак' }, 'logos/a.svg'),
        createTestEntry('b', 'customer', { index: '2', letters: 'Зак' }),
      ];
      const context = drawEntries(entries);

      expect(context.countOf('drawImage')).toBe(0);
      expect(context.countOf('fillText')).toBe(4);
    });

    it('draws the monogram when the picture has no size', () => {
      const context = drawEntries(
        LOGO_ENTRIES.slice(0, 1),
        new Map([['logos/c1.svg', createLogoImage(0, 76)]]),
      );

      expect(context.countOf('drawImage')).toBe(0);
      expect(context.countOf('fillText')).toBe(2);
    });

    it('shrinks a picture that is bigger than the field and never makes a small one bigger', () => {
      const context = drawEntries(
        LOGO_ENTRIES.slice(0, 2),
        new Map([
          ['logos/c1.svg', createLogoImage(284, 152)],
          ['logos/s1.svg', createLogoImage(60, 30)],
        ]),
      );
      const [big, small] = context.calls.filter(call => call.op === 'drawImage');

      expect(big?.args.slice(2)).toEqual([142, 76]);
      expect(small?.args.slice(2)).toEqual([60, 30]);
    });

    it('draws no picture in the shared cells of the sides', () => {
      const context = drawEntries([], new Map([['logos/c1.svg', createLogoImage(124, 76)]]));

      expect(context.countOf('drawImage')).toBe(0);
    });
  });
});
