import {
  describe,
  expect,
  it,
} from 'vitest';

import { buildNetworkSceneLayout } from '../layout';
import {
  createTestCity,
  createTestModel,
  createTestSite,
} from '../layout/layoutTestSupport';
import {
  FOCUS_MARGIN_METERS,
  MAX_FOCUS_ZOOM_FACTOR,
  resolveFocusZoomFactor,
  resolveNetworkFocusTarget,
} from './resolveNetworkFocusTarget';

const createLayout = (siteCountInA = 2): ReturnType<typeof buildNetworkSceneLayout> => buildNetworkSceneLayout(createTestModel(
  [createTestCity('a', 4, 2), createTestCity('b', 7, 3)],
  [],
  [
    ...Array.from(
      { length: siteCountInA },
      (_, index) => createTestSite(['a', String(index).padStart(2, '0')].join('-'), 'a', index === 0),
    ),
    createTestSite('b-site', 'b'),
  ],
));

describe('resolveNetworkFocusTarget', () => {
  it('points at the building of a site on the ground, with the radius of its city and the margin', () => {
    const layout = createLayout();
    const building = layout.buildings.find(candidate => candidate.siteId === 'b-site');
    const city = layout.cities.find(candidate => candidate.id === 'b');
    const target = resolveNetworkFocusTarget(layout, 'b-site');

    expect(target).toEqual({
      kind: 'site',
      point: { x: building?.x, y: 0, z: building?.z },
      radius: (city?.radius ?? 0) + FOCUS_MARGIN_METERS,
    });
  });

  it('points at the center of a city with its radius and the margin', () => {
    const layout = createLayout();
    const city = layout.cities.find(candidate => candidate.id === 'a');

    expect(resolveNetworkFocusTarget(layout, 'a')).toEqual({
      kind: 'city',
      point: { x: city?.x, y: 0, z: city?.z },
      radius: (city?.radius ?? 0) + FOCUS_MARGIN_METERS,
    });
  });

  it('points a site hidden by the overflow of its city at the center of the city', () => {
    const layout = createLayout(30);
    const [city] = layout.cities;
    const hiddenId = city?.hiddenSiteIds[0];

    expect(hiddenId).toBeDefined();
    expect(resolveNetworkFocusTarget(layout, hiddenId ?? '')).toEqual({
      kind: 'site',
      point: { x: city?.x, y: 0, z: city?.z },
      radius: (city?.radius ?? 0) + FOCUS_MARGIN_METERS,
    });
  });

  it('finds nothing for an unknown id', () => {
    expect(resolveNetworkFocusTarget(createLayout(), 'ghost')).toBeUndefined();
  });
});

describe('resolveFocusZoomFactor', () => {
  it('is the ratio of the home radius to the focus radius', () => {
    expect(resolveFocusZoomFactor(30, 10)).toBe(3);
    expect(resolveFocusZoomFactor(25, 10)).toBe(2.5);
  });

  it('never zooms out of the home', () => {
    expect(resolveFocusZoomFactor(10, 10)).toBe(1);
    expect(resolveFocusZoomFactor(8, 10)).toBe(1);
  });

  it('caps the factor at the maximum', () => {
    expect(MAX_FOCUS_ZOOM_FACTOR).toBe(4);
    expect(resolveFocusZoomFactor(400, 10)).toBe(MAX_FOCUS_ZOOM_FACTOR);
    expect(resolveFocusZoomFactor(40, 10)).toBe(MAX_FOCUS_ZOOM_FACTOR);
  });

  it('uses the maximum for an empty focus radius', () => {
    expect(resolveFocusZoomFactor(40, 0)).toBe(MAX_FOCUS_ZOOM_FACTOR);
  });
});
