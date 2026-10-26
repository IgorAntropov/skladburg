import {
  describe,
  expect,
  it,
} from 'vitest';

import type { MonogramPartsValue } from '@/entities/organization';

import { buildMonogramParts } from '@/entities/organization';

import {
  estimateMonogramWidth,
  readBannerTextBlock,
  SITE_BANNER_INDEX_WEIGHT,
  SITE_BANNER_LETTERS_WEIGHT,
  SITE_BANNER_MAX_TEXT_WIDTH_PX,
  SITE_BANNER_NEAR_WIDTH_PX,
  SITE_BANNER_SIZE_LADDER_PX,
} from './siteBannerTemplate';

const monogram = (letters: string, index: string): MonogramPartsValue => ({ index, letters });

describe('size ladder', () => {
  it('goes from 72 down to 30 px in steps of 2', () => {
    expect(SITE_BANNER_SIZE_LADDER_PX[0]).toBe(72);
    expect(SITE_BANNER_SIZE_LADDER_PX.at(-1)).toBe(30);
    expect(SITE_BANNER_SIZE_LADDER_PX).toHaveLength(22);

    for (const [position, size] of SITE_BANNER_SIZE_LADDER_PX.entries()) {
      expect(size).toBe(72 - position * 2);
    }
  });
});

describe('readBannerTextBlock', () => {
  it('sets Зак1 with 54 px letters and a 32.4 px index in two runs', () => {
    const block = readBannerTextBlock(monogram('Зак', '1'));

    expect(block.runs).toEqual([
      { fontSize: 54, fontWeight: SITE_BANNER_LETTERS_WEIGHT, gapBeforePx: 0, text: 'Зак' },
      { fontSize: 32.4, fontWeight: SITE_BANNER_INDEX_WEIGHT, gapBeforePx: 4.32, text: '1' },
    ]);
  });

  it('centers the cap height of the block on y = 66 and the block on the middle of the plate', () => {
    const block = readBannerTextBlock(monogram('Зак', '1'));

    expect(block.centerX).toBe(SITE_BANNER_NEAR_WIDTH_PX / 2);
    expect(block.capHeightPx).toBeCloseTo(38.88, 2);
    expect(block.baseline - block.capHeightPx / 2).toBeCloseTo(66, 2);
  });

  it('picks the largest step of the ladder that fits the width', () => {
    for (const parts of [monogram('Зак', '1'), monogram('Пос', '12'), monogram('СП', ''), monogram('Mmm', '300')]) {
      const block = readBannerTextBlock(parts);
      const size = block.runs[0]?.fontSize ?? 0;

      expect(SITE_BANNER_SIZE_LADDER_PX).toContain(size);
      expect(estimateMonogramWidth(parts, size)).toBeLessThanOrEqual(SITE_BANNER_MAX_TEXT_WIDTH_PX);

      if (size < 72) {
        expect(estimateMonogramWidth(parts, size + 2)).toBeGreaterThan(SITE_BANNER_MAX_TEXT_WIDTH_PX);
      }
    }
  });

  it('keeps the width of the block within 142 px for every monogram of the demo names', () => {
    const names = ['Заказчик 1', 'Заказчик 2', 'Поставщик 1', 'Поставщик 5', 'Перевозчик 2', 'Свежие продукты', 'ООО «Мясной двор»'];

    for (const name of names) {
      const parts = buildMonogramParts(name);
      const block = readBannerTextBlock(parts);
      const size = block.runs[0]?.fontSize ?? 0;

      expect(estimateMonogramWidth(parts, size)).toBeLessThanOrEqual(SITE_BANNER_MAX_TEXT_WIDTH_PX);
    }
  });

  it('sets one or two letters at the largest size with no index run', () => {
    const one = readBannerTextBlock(monogram('Я', ''));
    const two = readBannerTextBlock(monogram('СП', ''));

    expect(one.runs).toEqual([{ fontSize: 72, fontWeight: SITE_BANNER_LETTERS_WEIGHT, gapBeforePx: 0, text: 'Я' }]);
    expect(two.runs).toHaveLength(1);
    expect(two.runs[0]?.text).toBe('СП');
    expect(two.runs[0]?.fontSize).toBeLessThanOrEqual(72);
  });

  it('sets a lone index at full size with the letters weight', () => {
    const block = readBannerTextBlock(monogram('', '2024'));

    expect(block.runs).toHaveLength(1);
    expect(block.runs[0]).toMatchObject({
      fontWeight: SITE_BANNER_LETTERS_WEIGHT,
      gapBeforePx: 0,
      text: '2024',
    });
    expect(estimateMonogramWidth(monogram('', '2024'), block.runs[0]?.fontSize ?? 0))
      .toBeLessThanOrEqual(SITE_BANNER_MAX_TEXT_WIDTH_PX);
  });

  it('stops at the smallest step when nothing fits', () => {
    const block = readBannerTextBlock(monogram('', '123456789012345678'));

    expect(block.runs[0]?.fontSize).toBe(30);
  });

  it('gives no runs for an empty monogram so that the atlas draws the fallback circle', () => {
    const block = readBannerTextBlock(monogram('', ''));

    expect(block.runs).toEqual([]);
    expect(block.baseline - block.capHeightPx / 2).toBeCloseTo(66, 2);
  });

  it('measures wide capitals wider than narrow ones', () => {
    expect(estimateMonogramWidth(monogram('Ж', ''), 50)).toBeGreaterThan(estimateMonogramWidth(monogram('З', ''), 50));
    expect(estimateMonogramWidth(monogram('Жм', ''), 50)).toBeGreaterThan(estimateMonogramWidth(monogram('Зк', ''), 50));
  });
});
