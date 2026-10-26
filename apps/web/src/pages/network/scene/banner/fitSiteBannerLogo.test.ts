import {
  describe,
  expect,
  it,
} from 'vitest';

import { fitSiteBannerLogo } from './fitSiteBannerLogo';
import { SITE_BANNER_LOGO_FIELD } from './siteBannerTemplate';

const FIELD = SITE_BANNER_LOGO_FIELD;

describe('fitSiteBannerLogo', () => {
  it('shrinks a wide picture to the width of the field and keeps the proportion', () => {
    const placement = fitSiteBannerLogo(284, 100);

    expect(placement?.width).toBeCloseTo(142, 6);
    expect(placement?.height).toBeCloseTo(50, 6);
    expect((placement?.width ?? 0) / (placement?.height ?? 1)).toBeCloseTo(2.84, 6);
  });

  it('shrinks a tall picture to the height of the field and keeps the proportion', () => {
    const placement = fitSiteBannerLogo(50, 152);

    expect(placement?.height).toBeCloseTo(76, 6);
    expect(placement?.width).toBeCloseTo(25, 6);
  });

  it('shrinks a square picture to the shorter side of the field', () => {
    const placement = fitSiteBannerLogo(200, 200);

    expect(placement?.width).toBeCloseTo(76, 6);
    expect(placement?.height).toBeCloseTo(76, 6);
  });

  it('centers the picture on the middle of the field', () => {
    for (const [width, height] of [[284, 100], [50, 152], [200, 200], [60, 30]] as const) {
      const placement = fitSiteBannerLogo(width, height);

      expect((placement?.x ?? 0) + (placement?.width ?? 0) / 2).toBeCloseTo(FIELD.centerXPx, 6);
      expect((placement?.y ?? 0) + (placement?.height ?? 0) / 2).toBeCloseTo(FIELD.centerYPx, 6);
    }
  });

  it('keeps the picture inside the field', () => {
    for (const [width, height] of [[284, 100], [50, 152], [200, 200], [142, 76], [1000, 1]] as const) {
      const placement = fitSiteBannerLogo(width, height);

      expect(placement?.x ?? 0).toBeGreaterThanOrEqual(FIELD.centerXPx - FIELD.widthPx / 2 - 1e-9);
      expect((placement?.x ?? 0) + (placement?.width ?? 0)).toBeLessThanOrEqual(FIELD.centerXPx + FIELD.widthPx / 2 + 1e-9);
      expect(placement?.y ?? 0).toBeGreaterThanOrEqual(FIELD.centerYPx - FIELD.heightPx / 2 - 1e-9);
      expect((placement?.y ?? 0) + (placement?.height ?? 0)).toBeLessThanOrEqual(FIELD.centerYPx + FIELD.heightPx / 2 + 1e-9);
    }
  });

  it('never makes a small picture bigger', () => {
    expect(fitSiteBannerLogo(60, 30)).toEqual({ height: 30, width: 60, x: 92, y: 53 });
    expect(fitSiteBannerLogo(142, 76)).toEqual({ height: 76, width: 142, x: 51, y: 30 });
  });

  it('gives nothing for a picture with no size', () => {
    expect(fitSiteBannerLogo(0, 76)).toBeUndefined();
    expect(fitSiteBannerLogo(142, 0)).toBeUndefined();
    expect(fitSiteBannerLogo(-1, 10)).toBeUndefined();
    expect(fitSiteBannerLogo(Number.NaN, 10)).toBeUndefined();
    expect(fitSiteBannerLogo(10, Number.POSITIVE_INFINITY)).toBeUndefined();
  });
});
