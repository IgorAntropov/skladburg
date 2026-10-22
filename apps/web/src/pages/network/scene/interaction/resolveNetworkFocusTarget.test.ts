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
    const target = resolveNetworkFocusTarget(layout, 'b-site', undefined);

    expect(target).toEqual({
      kind: 'site',
      point: { x: building?.x, y: 0, z: building?.z },
      radius: (city?.radius ?? 0) + FOCUS_MARGIN_METERS,
    });
  });

  it('points at the center of a city with its radius and the margin', () => {
    const layout = createLayout();
    const city = layout.cities.find(candidate => candidate.id === 'a');

    expect(resolveNetworkFocusTarget(layout, 'a', undefined)).toEqual({
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
    expect(resolveNetworkFocusTarget(layout, hiddenId ?? '', undefined)).toEqual({
      kind: 'site',
      point: { x: city?.x, y: 0, z: city?.z },
      radius: (city?.radius ?? 0) + FOCUS_MARGIN_METERS,
    });
  });

  it('finds nothing for an unknown id', () => {
    expect(resolveNetworkFocusTarget(createLayout(), 'ghost', undefined)).toBeUndefined();
  });
});

describe('resolveNetworkFocusTarget for a list of sites', () => {
  const layout = buildNetworkSceneLayout(createTestModel(
    [createTestCity('a', 4, 2), createTestCity('b', 7, 3)],
    [],
    [createTestSite('a-1', 'a'), createTestSite('a-2', 'a'), createTestSite('b-1', 'b')],
  ));
  const cityA = layout.cities.find(candidate => candidate.id === 'a');
  const cityB = layout.cities.find(candidate => candidate.id === 'b');
  const buildingOf = (siteId: string): { x: number; z: number } => {
    const building = layout.buildings.find(candidate => candidate.siteId === siteId);

    return { x: building?.x ?? Number.NaN, z: building?.z ?? Number.NaN };
  };

  it('keeps the target of a list with one site exactly as the target of that site', () => {
    expect(resolveNetworkFocusTarget(layout, 'organization', ['b-1'])).toEqual(resolveNetworkFocusTarget(layout, 'b-1', undefined));
  });

  it('ignores the id when the list is given', () => {
    expect(resolveNetworkFocusTarget(layout, 'a', ['b-1'])).toEqual(resolveNetworkFocusTarget(layout, 'b-1', undefined));
  });

  it('encloses the sites of one city with a circle no smaller than the circle of the city', () => {
    const target = resolveNetworkFocusTarget(layout, 'organization', ['a-1', 'a-2']);
    const first = buildingOf('a-1');
    const second = buildingOf('a-2');

    expect(target?.radius).toBeGreaterThanOrEqual((cityA?.radius ?? 0) + FOCUS_MARGIN_METERS);
    expect(Math.hypot((target?.point.x ?? 0) - first.x, (target?.point.z ?? 0) - first.z) + (cityA?.radius ?? 0) + FOCUS_MARGIN_METERS)
      .toBeLessThanOrEqual((target?.radius ?? 0) + 1e-9);
    expect(Math.hypot((target?.point.x ?? 0) - second.x, (target?.point.z ?? 0) - second.z) + (cityA?.radius ?? 0) + FOCUS_MARGIN_METERS)
      .toBeLessThanOrEqual((target?.radius ?? 0) + 1e-9);
  });

  it('encloses the circles of the sites of different cities and stays on the ground', () => {
    const target = resolveNetworkFocusTarget(layout, 'organization', ['a-1', 'b-1']);
    const sites = [
      { city: cityA, point: buildingOf('a-1') },
      { city: cityB, point: buildingOf('b-1') },
    ];

    expect(target?.kind).toBe('site');
    expect(target?.point.y).toBe(0);

    for (const { city, point } of sites) {
      const reach = Math.hypot((target?.point.x ?? 0) - point.x, (target?.point.z ?? 0) - point.z)
        + (city?.radius ?? 0) + FOCUS_MARGIN_METERS;

      expect(reach).toBeLessThanOrEqual((target?.radius ?? 0) + 1e-9);
    }
  });

  it('touches both circles of two far apart cities and puts the center between them', () => {
    const target = resolveNetworkFocusTarget(layout, 'organization', ['a-1', 'b-1']);
    const first = buildingOf('a-1');
    const second = buildingOf('b-1');
    const radiusA = (cityA?.radius ?? 0) + FOCUS_MARGIN_METERS;
    const radiusB = (cityB?.radius ?? 0) + FOCUS_MARGIN_METERS;
    const distance = Math.hypot(second.x - first.x, second.z - first.z);

    expect(target?.radius).toBeCloseTo((distance + radiusA + radiusB) / 2, 6);
    expect(Math.hypot((target?.point.x ?? 0) - first.x, (target?.point.z ?? 0) - first.z) + radiusA).toBeCloseTo(target?.radius ?? 0, 6);
    expect(Math.hypot((target?.point.x ?? 0) - second.x, (target?.point.z ?? 0) - second.z) + radiusB).toBeCloseTo(target?.radius ?? 0, 6);
  });

  it('gives the same circle whatever the order of the sites', () => {
    const forward = resolveNetworkFocusTarget(layout, 'organization', ['a-1', 'b-1']);
    const backward = resolveNetworkFocusTarget(layout, 'organization', ['b-1', 'a-1']);

    expect(backward?.radius).toBeCloseTo(forward?.radius ?? 0, 6);
    expect(backward?.point.x).toBeCloseTo(forward?.point.x ?? 0, 6);
    expect(backward?.point.z).toBeCloseTo(forward?.point.z ?? 0, 6);
  });

  it('skips unknown ids and waits for the layout when none of the sites is known or the list is empty', () => {
    expect(resolveNetworkFocusTarget(layout, 'organization', ['ghost', 'b-1'])).toEqual(
      resolveNetworkFocusTarget(layout, 'b-1', undefined),
    );
    expect(resolveNetworkFocusTarget(layout, 'organization', ['ghost'])).toBeUndefined();
    expect(resolveNetworkFocusTarget(layout, 'organization', [])).toBeUndefined();
  });

  it('points a hidden site of a crowded city at the center of the city together with a visible site of another', () => {
    const crowded = buildNetworkSceneLayout(createTestModel(
      [createTestCity('a', 4, 2), createTestCity('b', 7, 3)],
      [],
      [
        ...Array.from({ length: 30 }, (_, index) => createTestSite(['a', String(index).padStart(2, '0')].join('-'), 'a')),
        createTestSite('b-site', 'b'),
      ],
    ));
    const hiddenId = crowded.cities.find(candidate => candidate.id === 'a')?.hiddenSiteIds[0] ?? '';
    const target = resolveNetworkFocusTarget(crowded, 'organization', [hiddenId, 'b-site']);

    expect(hiddenId).not.toBe('');
    expect(target?.radius).toBeGreaterThan(resolveNetworkFocusTarget(crowded, hiddenId, undefined)?.radius ?? 0);
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
