import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  isSiteBannerFontReady,
  loadSiteBannerFonts,
} from './siteBannerFonts';

const stubFonts = (value: unknown): void => {
  Object.defineProperty(document, 'fonts', { configurable: true, value });
};

describe('site banner fonts', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'fonts');
  });

  it('treat the fonts as ready when the document has no font set', async () => {
    expect(isSiteBannerFontReady()).toBe(true);
    await expect(loadSiteBannerFonts()).resolves.toBeUndefined();
  });

  it('are ready only when every probe of both weights is ready', () => {
    const check = vi.fn<(spec: string, sample: string) => boolean>().mockReturnValue(true);

    stubFonts({ check });

    expect(isSiteBannerFontReady()).toBe(true);
    expect(check.mock.calls.map(call => call[0])).toEqual(['800 64px Manrope', '800 64px Manrope', '600 64px Manrope']);

    check.mockReturnValueOnce(true).mockReturnValueOnce(false);

    expect(isSiteBannerFontReady()).toBe(false);
  });

  it('load both weights for the cyrillic and the latin samples', async () => {
    const load = vi.fn<(spec: string, sample: string) => Promise<unknown[]>>().mockResolvedValue([]);

    stubFonts({ load });
    await loadSiteBannerFonts();

    expect(load.mock.calls).toEqual([
      ['800 64px Manrope', 'АЯЗа'],
      ['800 64px Manrope', 'NF'],
      ['600 64px Manrope', '1234567890'],
    ]);
  });

  it('do not fail when a font does not load', async () => {
    stubFonts({ load: vi.fn().mockRejectedValue(new Error('offline')) });

    await expect(loadSiteBannerFonts()).resolves.toBeUndefined();
  });
});
