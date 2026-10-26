import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SITE_MARK_NEAR_ENTER_ZOOM,
  SITE_MARK_NEAR_EXIT_ZOOM,
} from '../banner/siteMarkMetrics';
import {
  FAR_WINDOW_MIN_NIGHT,
  WINDOW_DELAY_RANGE,
} from './nightConstants';
import {
  createWindowViewState,
  isFarWindowSetActive,
  updateWindowViewState,
} from './windowViewState';

const BETWEEN_THRESHOLDS_ZOOM = (SITE_MARK_NEAR_EXIT_ZOOM + SITE_MARK_NEAR_ENTER_ZOOM) / 2;

describe('isFarWindowSetActive', () => {
  it('turns the far set on only for a far view at night', () => {
    expect(isFarWindowSetActive(true, 1)).toBe(true);
    expect(isFarWindowSetActive(true, 0)).toBe(false);
    expect(isFarWindowSetActive(false, 1)).toBe(false);
    expect(isFarWindowSetActive(false, 0)).toBe(false);
  });

  it('switches on at the night threshold and not before it', () => {
    expect(isFarWindowSetActive(true, FAR_WINDOW_MIN_NIGHT)).toBe(true);
    expect(isFarWindowSetActive(true, FAR_WINDOW_MIN_NIGHT - 0.001)).toBe(false);
  });

  it('switches before the first window of the delay wave lights up', () => {
    expect(FAR_WINDOW_MIN_NIGHT).toBeLessThan(WINDOW_DELAY_RANGE[0]);
  });
});

describe('updateWindowViewState', () => {
  it('starts with the near set and a far view', () => {
    const view = createWindowViewState();

    expect(view).toEqual({ isFarSet: false, isViewFar: true });
  });

  it('reports a change only when the active set switches', () => {
    const view = createWindowViewState();

    expect(updateWindowViewState(view, 10, 0)).toBe(false);
    expect(updateWindowViewState(view, 10, 1)).toBe(true);
    expect(updateWindowViewState(view, 10, 1)).toBe(false);
    expect(updateWindowViewState(view, SITE_MARK_NEAR_ENTER_ZOOM, 1)).toBe(true);
    expect(view).toEqual({ isFarSet: false, isViewFar: false });
    expect(updateWindowViewState(view, SITE_MARK_NEAR_ENTER_ZOOM, 1)).toBe(false);
  });

  it('keeps the far set inside the zoom hysteresis and the near set on the way back', () => {
    const view = createWindowViewState();

    updateWindowViewState(view, 10, 1);

    expect(updateWindowViewState(view, BETWEEN_THRESHOLDS_ZOOM, 1)).toBe(false);
    expect(view.isFarSet).toBe(true);

    updateWindowViewState(view, SITE_MARK_NEAR_ENTER_ZOOM, 1);

    expect(updateWindowViewState(view, BETWEEN_THRESHOLDS_ZOOM, 1)).toBe(false);
    expect(view.isFarSet).toBe(false);
    expect(updateWindowViewState(view, SITE_MARK_NEAR_EXIT_ZOOM - 0.01, 1)).toBe(true);
    expect(view.isFarSet).toBe(true);
  });

  it('drops the far set when the day comes back below the night threshold', () => {
    const view = createWindowViewState();

    updateWindowViewState(view, 10, 1);

    expect(updateWindowViewState(view, 10, FAR_WINDOW_MIN_NIGHT - 0.01)).toBe(true);
    expect(view.isFarSet).toBe(false);
  });

  it('treats an unknown zoom as a far view', () => {
    const view = createWindowViewState();

    expect(updateWindowViewState(view, 0, 1)).toBe(true);
    expect(view.isViewFar).toBe(true);
  });
});
