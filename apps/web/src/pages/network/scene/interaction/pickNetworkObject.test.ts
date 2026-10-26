import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  PickCandidatesValue,
  PickCityValue,
  PickSiteValue,
} from './pickNetworkObject';

import {
  MOUSE_CAPTURE_RADIUS_PX,
  pickNetworkObject,
  resolveCaptureRadius,
  TOUCH_CAPTURE_RADIUS_PX,
} from './pickNetworkObject';

const createSite = (id: string, x: number, y: number, reachPx = 0): PickSiteValue => ({
  baseX: x,
  baseY: y,
  id,
  reachPx,
  tipX: x,
  tipY: y - 40,
});

const createCity = (id: string, x: number, y: number, radiusX = 60, radiusY = 35): PickCityValue => ({
  id,
  radiusX,
  radiusY,
  x,
  y,
});

const createCandidates = (sites: PickSiteValue[], cities: PickCityValue[] = []): PickCandidatesValue => ({ cities, sites });

describe('resolveCaptureRadius', () => {
  it('gives a touch at least half of a 44 pixel target and a mouse less', () => {
    expect(TOUCH_CAPTURE_RADIUS_PX).toBeGreaterThanOrEqual(22);
    expect(MOUSE_CAPTURE_RADIUS_PX).toBeLessThan(TOUCH_CAPTURE_RADIUS_PX);
    expect(resolveCaptureRadius('touch')).toBe(TOUCH_CAPTURE_RADIUS_PX);
    expect(resolveCaptureRadius('pen')).toBe(TOUCH_CAPTURE_RADIUS_PX);
    expect(resolveCaptureRadius('mouse')).toBe(MOUSE_CAPTURE_RADIUS_PX);
  });
});

describe('pickNetworkObject', () => {
  it('picks a site by the base of its building', () => {
    const candidates = createCandidates([createSite('s1', 200, 300)]);

    expect(pickNetworkObject({ x: 204, y: 304 }, candidates, 12)).toEqual({ id: 's1', kind: 'site' });
  });

  it('picks a site by its site mark and by any point of the segment between them', () => {
    const candidates = createCandidates([createSite('s1', 200, 300)]);

    expect(pickNetworkObject({ x: 200, y: 262 }, candidates, 12)).toEqual({ id: 's1', kind: 'site' });
    expect(pickNetworkObject({ x: 208, y: 280 }, candidates, 12)).toEqual({ id: 's1', kind: 'site' });
  });

  it('misses a point outside of the capture radius', () => {
    const candidates = createCandidates([createSite('s1', 200, 300)]);

    expect(pickNetworkObject({ x: 213, y: 300 }, candidates, 12)).toBeUndefined();
    expect(pickNetworkObject({ x: 200, y: 313 }, candidates, 12)).toBeUndefined();
    expect(pickNetworkObject({ x: 0, y: 0 }, candidates, 12)).toBeUndefined();
  });

  it('widens the capture by the reach of the site mark', () => {
    const candidates = createCandidates([createSite('s1', 200, 300, 30)]);

    expect(pickNetworkObject({ x: 240, y: 300 }, candidates, 12)).toEqual({ id: 's1', kind: 'site' });
    expect(pickNetworkObject({ x: 243, y: 300 }, candidates, 12)).toBeUndefined();
  });

  it('takes a bigger radius for a touch than for a mouse at the same point', () => {
    const candidates = createCandidates([createSite('s1', 200, 300)]);
    const point = { x: 218, y: 300 };

    expect(pickNetworkObject(point, candidates, MOUSE_CAPTURE_RADIUS_PX)).toBeUndefined();
    expect(pickNetworkObject(point, candidates, TOUCH_CAPTURE_RADIUS_PX)).toEqual({ id: 's1', kind: 'site' });
  });

  it('picks the nearest of two sites', () => {
    const candidates = createCandidates([createSite('s1', 200, 300), createSite('s2', 214, 300)]);

    expect(pickNetworkObject({ x: 203, y: 300 }, candidates, 22)).toEqual({ id: 's1', kind: 'site' });
    expect(pickNetworkObject({ x: 211, y: 300 }, candidates, 22)).toEqual({ id: 's2', kind: 'site' });
  });

  it('breaks a tie by the id whatever the order of the candidates', () => {
    const first = createCandidates([createSite('b', 200, 300), createSite('a', 200, 300)]);
    const second = createCandidates([createSite('a', 200, 300), createSite('b', 200, 300)]);

    expect(pickNetworkObject({ x: 205, y: 300 }, first, 12)?.id).toBe('a');
    expect(pickNetworkObject({ x: 205, y: 300 }, second, 12)?.id).toBe('a');
  });

  it('picks a city inside of its ellipse', () => {
    const candidates = createCandidates([], [createCity('c1', 400, 300)]);

    expect(pickNetworkObject({ x: 400, y: 300 }, candidates, 12)).toEqual({ id: 'c1', kind: 'city' });
    expect(pickNetworkObject({ x: 450, y: 300 }, candidates, 12)).toEqual({ id: 'c1', kind: 'city' });
  });

  it('squeezes the city ellipse vertically', () => {
    const candidates = createCandidates([], [createCity('c1', 400, 300)]);

    expect(pickNetworkObject({ x: 400, y: 300 + 35 + 11 }, candidates, 12)).toEqual({ id: 'c1', kind: 'city' });
    expect(pickNetworkObject({ x: 400, y: 300 + 35 + 14 }, candidates, 12)).toBeUndefined();
    expect(pickNetworkObject({ x: 400 + 60 + 11, y: 300 }, candidates, 12)).toEqual({ id: 'c1', kind: 'city' });
  });

  it('misses a point outside of every city', () => {
    const candidates = createCandidates([], [createCity('c1', 400, 300)]);

    expect(pickNetworkObject({ x: 600, y: 300 }, candidates, 12)).toBeUndefined();
    expect(pickNetworkObject({ x: 450, y: 340 }, candidates, 12)).toBeUndefined();
  });

  it('prefers the site inside of a city over the city', () => {
    const candidates = createCandidates([createSite('s1', 400, 310)], [createCity('c1', 400, 300)]);

    expect(pickNetworkObject({ x: 402, y: 312 }, candidates, 12)).toEqual({ id: 's1', kind: 'site' });
    expect(pickNetworkObject({ x: 450, y: 312 }, candidates, 12)).toEqual({ id: 'c1', kind: 'city' });
  });

  it('picks the nearest of overlapping cities and breaks a tie by the id', () => {
    const candidates = createCandidates([], [createCity('c2', 440, 300), createCity('c1', 380, 300)]);

    expect(pickNetworkObject({ x: 390, y: 300 }, candidates, 12)?.id).toBe('c1');
    expect(pickNetworkObject({ x: 430, y: 300 }, candidates, 12)?.id).toBe('c2');
    expect(pickNetworkObject({ x: 410, y: 300 }, candidates, 12)?.id).toBe('c1');
  });

  it('finds nothing without candidates', () => {
    expect(pickNetworkObject({ x: 1, y: 1 }, createCandidates([]), 22)).toBeUndefined();
  });
});
