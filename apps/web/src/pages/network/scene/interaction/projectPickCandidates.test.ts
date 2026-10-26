import { OrthographicCamera } from 'three';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkSceneLayoutValue } from '../layout';

import { buildNetworkSceneLayout } from '../layout';
import {
  createTestCity,
  createTestModel,
  createTestSite,
} from '../layout/layoutTestSupport';
import {
  buildPickTargets,
  createPickCandidates,
  projectPickCandidates,
} from './projectPickCandidates';

const SIZE = { height: 800, width: 1200 };
const ZOOM_PX_PER_METER = 10;
const ELEVATION = Math.atan(1 / Math.SQRT2);

const createCamera = (azimuth: number, lookX = 0, lookZ = 0, zoom = ZOOM_PX_PER_METER): OrthographicCamera => {
  const camera = new OrthographicCamera(-SIZE.width / 2, SIZE.width / 2, SIZE.height / 2, -SIZE.height / 2, 0.1, 2000);
  const distance = 500;

  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.position.set(
    lookX + distance * Math.cos(ELEVATION) * Math.sin(azimuth),
    distance * Math.sin(ELEVATION),
    lookZ + distance * Math.cos(ELEVATION) * Math.cos(azimuth),
  );
  camera.lookAt(lookX, 0, lookZ);
  camera.updateMatrixWorld();

  return camera;
};

const createLayout = (): NetworkSceneLayoutValue => buildNetworkSceneLayout(createTestModel(
  [createTestCity('a', 4, 2), createTestCity('b', 7, 3)],
  [],
  [createTestSite('s1', 'a', true), createTestSite('s2', 'a'), createTestSite('s3', 'b')],
));

describe('buildPickTargets', () => {
  it('lists a site once for each company building and every city', () => {
    const layout = createLayout();
    const targets = buildPickTargets(layout);

    expect(targets.sites.map(site => site.id).toSorted()).toEqual(['s1', 's2', 's3']);
    expect(targets.cities.map(city => city.id)).toEqual(['a', 'b']);
  });

  it('does not list the sites hidden by the overflow of a city', () => {
    const sites = Array.from({ length: 30 }, (_, index) => createTestSite(['site', String(index)].join('-'), 'a'));
    const layout = buildNetworkSceneLayout(createTestModel([createTestCity('a', 4, 2)], [], sites));
    const targets = buildPickTargets(layout);

    expect(layout.cities[0]?.hiddenSiteIds.length).toBeGreaterThan(0);
    expect(targets.sites).toHaveLength(sites.length - (layout.cities[0]?.hiddenSiteIds.length ?? 0));

    for (const hiddenId of layout.cities[0]?.hiddenSiteIds ?? []) {
      expect(targets.sites.map(site => site.id)).not.toContain(hiddenId);
    }
  });
});

describe('projectPickCandidates', () => {
  it('sizes the candidates like the targets', () => {
    const targets = buildPickTargets(createLayout());
    const candidates = createPickCandidates(targets);

    expect(candidates.sites).toHaveLength(3);
    expect(candidates.cities).toHaveLength(2);
  });

  it('puts the site mark of a site over its base on the screen', () => {
    const layout = createLayout();
    const targets = buildPickTargets(layout);
    const candidates = projectPickCandidates(targets, createCamera(Math.PI / 4), SIZE, createPickCandidates(targets), true);

    for (const site of candidates.sites) {
      expect(site.tipY).toBeLessThan(site.baseY);
      expect(site.tipX).toBeCloseTo(site.baseX, 6);
    }
  });

  it('gives the city circle the scale of the camera and squeezes it vertically by the elevation', () => {
    const layout = createLayout();
    const targets = buildPickTargets(layout);

    for (const azimuth of [Math.PI / 4, (3 * Math.PI) / 4, -Math.PI / 4]) {
      const candidates = projectPickCandidates(targets, createCamera(azimuth), SIZE, createPickCandidates(targets), true);

      for (const [index, city] of candidates.cities.entries()) {
        const radius = layout.cities[index]?.radius ?? 0;

        expect(city.radiusX).toBeCloseTo(radius * ZOOM_PX_PER_METER, 4);
        expect(city.radiusY).toBeCloseTo(radius * ZOOM_PX_PER_METER * Math.sin(ELEVATION), 4);
      }
    }
  });

  it('puts the city under the look-at point to the middle of the screen', () => {
    const layout = createLayout();
    const [first] = layout.cities;
    const targets = buildPickTargets(layout);
    const candidates = projectPickCandidates(
      targets,
      createCamera(Math.PI / 4, first?.x ?? 0, first?.z ?? 0),
      SIZE,
      createPickCandidates(targets),
      true,
    );

    expect(candidates.cities[0]?.x).toBeCloseTo(SIZE.width / 2, 3);
    expect(Math.abs((candidates.cities[0]?.y ?? 0) - SIZE.height / 2)).toBeLessThan(1);
  });

  it('reaches half the width of the near banner, 1.6 m, in the near view', () => {
    const targets = buildPickTargets(createLayout());

    for (const zoom of [22, 32, 48]) {
      const candidates = projectPickCandidates(
        targets,
        createCamera(Math.PI / 4, 0, 0, zoom),
        SIZE,
        createPickCandidates(targets),
        false,
      );

      for (const site of candidates.sites) {
        expect(site.reachPx).toBeCloseTo(1.6 * zoom, 4);
      }
    }
  });

  it('reaches half the width of the far flag, 1 m, in the far view', () => {
    const targets = buildPickTargets(createLayout());

    for (const zoom of [6.4, 9, 18]) {
      const candidates = projectPickCandidates(
        targets,
        createCamera(Math.PI / 4, 0, 0, zoom),
        SIZE,
        createPickCandidates(targets),
        true,
      );

      for (const site of candidates.sites) {
        expect(site.reachPx).toBeCloseTo(1 * zoom, 4);
      }
    }
  });

  it('takes the reach of the view each time the projection is written', () => {
    const targets = buildPickTargets(createLayout());
    const out = createPickCandidates(targets);
    const camera = createCamera(Math.PI / 4);

    projectPickCandidates(targets, camera, SIZE, out, false);
    const nearReach = out.sites[0]?.reachPx ?? 0;

    projectPickCandidates(targets, camera, SIZE, out, true);
    const farReach = out.sites[0]?.reachPx ?? 0;

    expect(nearReach).toBeCloseTo(1.6 * ZOOM_PX_PER_METER, 4);
    expect(farReach).toBeCloseTo(1 * ZOOM_PX_PER_METER, 4);
    expect(nearReach / farReach).toBeCloseTo(1.6, 6);
  });

  it('writes into the given object and returns it', () => {
    const targets = buildPickTargets(createLayout());
    const out = createPickCandidates(targets);

    expect(projectPickCandidates(targets, createCamera(Math.PI / 4), SIZE, out, true)).toBe(out);
  });
});
