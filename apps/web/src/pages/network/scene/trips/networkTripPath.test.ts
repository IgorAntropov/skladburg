import {
  describe,
  expect,
  it,
} from 'vitest';

import type { NetworkTripActorValue } from '../../model/networkTripActor';

import {
  createBuilding,
  createCity,
  createRoad,
} from '../night/nightTestSupport';
import {
  advanceNetworkTripPose,
  sampleNetworkTripPath,
} from './networkTripMotion';
import { buildNetworkTripPath } from './networkTripPath';

const createActor = (overrides: Partial<NetworkTripActorValue> = {}): NetworkTripActorValue => ({
  arrivalAtMs: 3_000,
  brandLabel: 'Перевозчик',
  deliverySiteId: 'delivery',
  departureAtMs: 1_000,
  fromNodeId: 'a',
  id: 'trip',
  phase: 'moving',
  pickupSiteId: 'pickup',
  registrationNumber: 'А123ВС 45',
  routeLegIds: ['ab', 'bc'],
  toNodeId: 'c',
  ...overrides,
});

const a = createCity('a', 0, 0);
const b = createCity('b', 10, 0);
const c = createCity('c', 10, 10);
const cities = [a, b, c];
const roads = [createRoad('ab', b, a), createRoad('bc', b, c)];

describe('buildNetworkTripPath', () => {
  it('follows the ordered and directed server legs through each bend', () => {
    const path = buildNetworkTripPath(createActor(), { buildings: [], cities, roads });

    if (path === undefined) {
      throw new Error('The test route must have a path');
    }

    const pose = { heading: 0, x: 0, z: 0 };
    sampleNetworkTripPath(path, 0.25, pose);
    expect(pose).toMatchObject({ heading: Math.PI / 2, x: 5, z: 0 });
    sampleNetworkTripPath(path, 0.75, pose);
    expect(pose).toMatchObject({ heading: 0, x: 10, z: 5 });
  });

  it('rejects incomplete, unordered and wrong-destination routes', () => {
    const layout = { buildings: [], cities, roads };

    expect(buildNetworkTripPath(createActor({ routeLegIds: ['ab', 'missing'] }), layout)).toBeUndefined();
    expect(buildNetworkTripPath(createActor({ routeLegIds: ['bc', 'ab'] }), layout)).toBeUndefined();
    expect(buildNetworkTripPath(createActor({ routeLegIds: ['ab'] }), layout)).toBeUndefined();
  });

  it('joins two distinct warehouse approaches on the same node', () => {
    const buildings = [
      createBuilding({ cityId: 'a', depth: 2, siteId: 'pickup', x: 0, z: 0 }),
      createBuilding({ cityId: 'a', depth: 2, siteId: 'delivery', x: 4, z: 0 }),
    ];
    const actor = createActor({ routeLegIds: [], toNodeId: 'a' });
    const path = buildNetworkTripPath(actor, { buildings, cities, roads });

    if (path === undefined) {
      throw new Error('The local route must have a path');
    }

    const pose = { heading: 0, x: 0, z: 0 };
    sampleNetworkTripPath(path, 0, pose);
    expect(pose.x).toBe(0);
    expect(pose.z).toBeGreaterThan(1);
    sampleNetworkTripPath(path, 1, pose);
    expect(pose.x).toBe(4);
    expect(pose.z).toBeGreaterThan(1);
    expect(buildNetworkTripPath(actor, { buildings: [], cities, roads })).toBeUndefined();
  });

  it('routes around a rotated building between the warehouse approaches', () => {
    const buildings = [
      createBuilding({ cityId: 'a', depth: 2, siteId: 'pickup', width: 1.4, x: -3, z: 0 }),
      createBuilding({ cityId: 'a', depth: 2, siteId: 'delivery', width: 1.4, x: 3, z: 0 }),
      createBuilding({ cityId: 'a', depth: 1, rotation: Math.PI / 2, width: 2, x: 0, z: 1.9 }),
      createBuilding({ cityId: 'a', depth: 1, rotation: Math.PI / 2, width: 2, x: 0, z: -1.9 }),
    ];
    const actor = createActor({ routeLegIds: [], toNodeId: 'a' });
    const path = buildNetworkTripPath(actor, { buildings, cities, roads });

    if (path === undefined) {
      throw new Error('There is room to drive around the building');
    }

    const pose = { heading: 0, x: 0, z: 0 };
    for (let percent = 0; percent <= 100; percent += 1) {
      sampleNetworkTripPath(path, percent / 100, pose);
      expect(Math.abs(pose.x) < 0.9 && Math.abs(Math.abs(pose.z) - 1.9) < 1.4).toBe(false);
    }
    expect(path.distance).toBeGreaterThan(6);
  });

  it.each([
    {
      actor: createActor({ routeLegIds: [], toNodeId: 'a' }),
      buildings: [
        createBuilding({ cityId: 'a', depth: 1.5, siteId: 'pickup', width: 2, x: 0, z: -3.2 }),
        createBuilding({ cityId: 'a', depth: 1.5, siteId: 'delivery', width: 2, x: 0, z: 3.2 }),
      ],
      city: a,
      route: 'local',
    },
    {
      actor: createActor(),
      buildings: [],
      city: b,
      route: 'intercity',
    },
  ])('routes a $route trip through a city with an occupied center', ({ actor, buildings, city }) => {
    const obstacle = createBuilding({ cityId: city.id, depth: 1.5, width: 2, x: city.x, z: city.z });
    const path = buildNetworkTripPath(actor, { buildings: [...buildings, obstacle], cities, roads });

    if (path === undefined) {
      throw new Error('The road or warehouses remain reachable around the occupied center');
    }

    const pose = { heading: 0, x: 0, z: 0 };
    for (let percent = 0; percent <= 100; percent += 1) {
      sampleNetworkTripPath(path, percent / 100, pose);
      expect(Math.abs(pose.x - city.x) < 1.35 && Math.abs(pose.z - city.z) < 1.1).toBe(false);
    }
  });
});

describe('advanceNetworkTripPose', () => {
  it('holds at pickup and eases a clock jump in transit', () => {
    const actor = createActor();
    const path = buildNetworkTripPath(actor, { buildings: [], cities, roads });

    if (path === undefined) {
      throw new Error('The test route must have a path');
    }

    const pose = { heading: 0, progress: 0.5, x: 0, z: 0 };
    expect(advanceNetworkTripPose({ ...actor, phase: 'loading' }, path, pose, 2_000, 1)).toBe(false);
    expect(pose).toMatchObject({ progress: 0, x: 0, z: 0 });
    expect(advanceNetworkTripPose(actor, path, pose, 2_000, 0.1)).toBe(true);
    expect(pose.progress).toBeGreaterThan(0);
    expect(pose.progress).toBeLessThan(0.5);
  });

  it('catches up at arrival only when a prior pose is still in transit', () => {
    const actor = createActor({ phase: 'arrived' });
    const path = buildNetworkTripPath(actor, { buildings: [], cities, roads });

    if (path === undefined) {
      throw new Error('The test route must have a path');
    }

    const pose = { heading: 0, progress: 0.5, x: 10, z: 0 };
    const arrivedPose = { heading: 0, progress: 1, x: 0, z: 0 };

    expect(advanceNetworkTripPose(actor, path, pose, 4_000, 0)).toBe(true);
    expect(pose.progress).toBe(0.5);
    expect(advanceNetworkTripPose(actor, path, pose, 4_000, 0.1)).toBe(true);
    expect(pose.progress).toBeGreaterThan(0.5);
    expect(pose.progress).toBeLessThan(1);

    for (let tick = 0; tick < 40; tick += 1) {
      advanceNetworkTripPose(actor, path, pose, 4_000, 0.1);
    }

    expect(advanceNetworkTripPose(actor, path, pose, 4_000, 0.1)).toBe(false);
    expect(advanceNetworkTripPose(actor, path, arrivedPose, 4_000, 0)).toBe(false);
    expect(pose).toEqual(arrivedPose);
    expect(arrivedPose).toMatchObject({ progress: 1, x: 10, z: 10 });
  });
});
