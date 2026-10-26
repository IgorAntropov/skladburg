import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createSiteMarkMode,
  resolveSiteMarkIsFar,
  SITE_MARK_FAR_PICK_RADIUS_METERS,
  SITE_MARK_NEAR_EXIT_ZOOM,
  SITE_MARK_NEAR_PICK_RADIUS_METERS,
  writeSiteMarkModeIsFar,
} from './siteMarkMetrics';

describe('resolveSiteMarkIsFar', () => {
  it('enters the near view from 22 px per meter', () => {
    expect(resolveSiteMarkIsFar(21.99, true)).toBe(true);
    expect(resolveSiteMarkIsFar(22, true)).toBe(false);
    expect(resolveSiteMarkIsFar(48, true)).toBe(false);
  });

  it('leaves the near view only below 0.82 of the entry zoom', () => {
    expect(SITE_MARK_NEAR_EXIT_ZOOM).toBeCloseTo(18.04, 10);
    expect(resolveSiteMarkIsFar(18.05, false)).toBe(false);
    expect(resolveSiteMarkIsFar(SITE_MARK_NEAR_EXIT_ZOOM, false)).toBe(false);
    expect(resolveSiteMarkIsFar(18.03, false)).toBe(true);
  });

  it('keeps the view inside the band between the exit and the entry zoom', () => {
    for (const zoom of [18.1, 20, 21.9]) {
      expect(resolveSiteMarkIsFar(zoom, true)).toBe(true);
      expect(resolveSiteMarkIsFar(zoom, false)).toBe(false);
    }
  });

  it('does not flicker while the wheel moves around the threshold', () => {
    let isFar = true;
    const views: boolean[] = [];

    for (const zoom of [20, 21.9, 22.1, 21.5, 19, 18.1, 17.9, 19, 21.9, 22]) {
      isFar = resolveSiteMarkIsFar(zoom, isFar);
      views.push(isFar);
    }

    expect(views).toEqual([true, true, false, false, false, false, true, true, true, false]);
  });

  it.each([Number.NaN, 0, -3, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'falls back to the far view for the zoom %s',
    (zoom) => {
      expect(resolveSiteMarkIsFar(zoom, true)).toBe(true);
      expect(resolveSiteMarkIsFar(zoom, false)).toBe(true);
    },
  );
});

describe('createSiteMarkMode', () => {
  it('starts in the far view and gives a new object each time', () => {
    const mode = createSiteMarkMode();

    expect(mode).toEqual({ isFar: true });
    expect(createSiteMarkMode()).not.toBe(mode);
  });
});

describe('writeSiteMarkModeIsFar', () => {
  it('writes the view into the shared mode object in place', () => {
    const mode = createSiteMarkMode();

    writeSiteMarkModeIsFar(mode, false);
    expect(mode.isFar).toBe(false);

    writeSiteMarkModeIsFar(mode, true);
    expect(mode.isFar).toBe(true);
  });
});

describe('pick radii', () => {
  it('are the half widths of the near banner and of the far flag', () => {
    expect(SITE_MARK_NEAR_PICK_RADIUS_METERS).toBe(1.6);
    expect(SITE_MARK_FAR_PICK_RADIUS_METERS).toBe(1);
  });
});
