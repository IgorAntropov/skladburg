import {
  describe,
  expect,
  it,
} from 'vitest';

import { readWorldPalette } from '@/shared/3d';

import {
  buildSiteBannerColorsSignature,
  readSiteBannerColors,
  toCssColor,
} from './siteBannerColors';

describe('toCssColor', () => {
  it('writes the channels as whole numbers and keeps the alpha', () => {
    expect(toCssColor({ alpha: 1, blue: 233, green: 245, red: 250 })).toBe('rgba(250, 245, 233, 1)');
    expect(toCssColor({ alpha: 0.5, blue: 74.4, green: 42.6, red: 30 })).toBe('rgba(30, 43, 74, 0.5)');
  });
});

describe('readSiteBannerColors', () => {
  const properties = new Map([
    ['--world-banner-plate', '#faf5e9'],
    ['--world-banner-text', '#1e2a4a'],
    ['--world-side-carrier', '#112233'],
    ['--world-side-customer', '#445566'],
    ['--world-side-rim', '#ffffff'],
    ['--world-side-supplier', '#778899'],
  ]);
  const palette = readWorldPalette(name => properties.get(name) ?? '#000000');

  it('takes the banner and side colors from the world palette', () => {
    expect(readSiteBannerColors(palette)).toEqual({
      carrier: 'rgba(17, 34, 51, 1)',
      customer: 'rgba(68, 85, 102, 1)',
      plate: 'rgba(250, 245, 233, 1)',
      rim: 'rgba(255, 255, 255, 1)',
      supplier: 'rgba(119, 136, 153, 1)',
      text: 'rgba(30, 42, 74, 1)',
    });
  });

  it('gives the same signature for the same colors and another one when any color differs', () => {
    const colors = readSiteBannerColors(palette);
    const signature = buildSiteBannerColorsSignature(colors);

    expect(buildSiteBannerColorsSignature({ ...colors })).toBe(signature);

    for (const key of Object.keys(colors) as (keyof typeof colors)[]) {
      expect(buildSiteBannerColorsSignature({ ...colors, [key]: 'rgba(0, 0, 0, 1)' })).not.toBe(signature);
    }
  });
});
