import type { RouteLeg } from '@skladburg/contracts/network/v1/network';

import { create } from '@bufbuild/protobuf';
import { RouteLegSchema } from '@skladburg/contracts/network/v1/network';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  SeedMapNodeId,
  SeedRouteLegId,
} from '../../seed/seedIds';
import { createSeedRouteLegs } from '../../seed/seedNetwork';
import {
  createRouteGraph,
  findRoute,
  findRoutesFrom,
} from './routeGraph';

interface LegDefinitionValue {
  distanceKm: number;
  driveMinutes: number;
  from: string;
  id: string;
  to: string;
}

const createLeg = (definition: LegDefinitionValue): RouteLeg => create(RouteLegSchema, {
  distanceKm: definition.distanceKm,
  driveMinutes: definition.driveMinutes,
  fromMapNodeId: definition.from,
  id: definition.id,
  toMapNodeId: definition.to,
});

const createLegs = (definitions: readonly LegDefinitionValue[]): RouteLeg[] => definitions.map(createLeg);

interface RouteCaseValue {
  expected: {
    distanceKm: number;
    driveMinutes: number;
    legIds: string[];
    mapNodeIds: string[];
  };
  from: string;
  legs: LegDefinitionValue[];
  name: string;
  to: string;
}

const ROUTE_CASES: readonly RouteCaseValue[] = [
  {
    expected: {
      distanceKm: 30,
      driveMinutes: 30,
      legIds: ['ab', 'bc'],
      mapNodeIds: ['a', 'b', 'c'],
    },
    from: 'a',
    legs: [
      { distanceKm: 10, driveMinutes: 10, from: 'a', id: 'ab', to: 'b' },
      { distanceKm: 20, driveMinutes: 20, from: 'b', id: 'bc', to: 'c' },
      { distanceKm: 50, driveMinutes: 40, from: 'a', id: 'ac', to: 'c' },
    ],
    name: 'picks the shorter path in kilometers over the direct leg',
    to: 'c',
  },
  {
    expected: {
      distanceKm: 100,
      driveMinutes: 90,
      legIds: ['ac'],
      mapNodeIds: ['a', 'c'],
    },
    from: 'a',
    legs: [
      { distanceKm: 100, driveMinutes: 90, from: 'a', id: 'ac', to: 'c' },
      { distanceKm: 60, driveMinutes: 50, from: 'a', id: 'ab', to: 'b' },
      { distanceKm: 40, driveMinutes: 50, from: 'b', id: 'bc', to: 'c' },
    ],
    name: 'prefers fewer minutes when kilometers are equal',
    to: 'c',
  },
  {
    expected: {
      distanceKm: 100,
      driveMinutes: 100,
      legIds: ['ab', 'bc'],
      mapNodeIds: ['a', 'b', 'c'],
    },
    from: 'a',
    legs: [
      { distanceKm: 100, driveMinutes: 120, from: 'a', id: 'ac', to: 'c' },
      { distanceKm: 60, driveMinutes: 60, from: 'a', id: 'ab', to: 'b' },
      { distanceKm: 40, driveMinutes: 40, from: 'b', id: 'bc', to: 'c' },
    ],
    name: 'prefers fewer minutes over a direct leg with equal kilometers',
    to: 'c',
  },
  {
    expected: {
      distanceKm: 100,
      driveMinutes: 100,
      legIds: ['ab', 'bc'],
      mapNodeIds: ['a', 'b', 'c'],
    },
    from: 'a',
    legs: [
      { distanceKm: 50, driveMinutes: 50, from: 'a', id: 'ad', to: 'd' },
      { distanceKm: 50, driveMinutes: 50, from: 'd', id: 'dc', to: 'c' },
      { distanceKm: 50, driveMinutes: 50, from: 'a', id: 'ab', to: 'b' },
      { distanceKm: 50, driveMinutes: 50, from: 'b', id: 'bc', to: 'c' },
    ],
    name: 'breaks a full tie by the lexicographically smaller leg ids',
    to: 'c',
  },
  {
    expected: {
      distanceKm: 100,
      driveMinutes: 100,
      legIds: ['a2', 'z1'],
      mapNodeIds: ['a', 'b', 'c'],
    },
    from: 'a',
    legs: [
      { distanceKm: 50, driveMinutes: 50, from: 'a', id: 'a2', to: 'b' },
      { distanceKm: 50, driveMinutes: 50, from: 'a', id: 'a9', to: 'b' },
      { distanceKm: 50, driveMinutes: 50, from: 'b', id: 'z1', to: 'c' },
    ],
    name: 'breaks a tie between parallel legs by id',
    to: 'c',
  },
  {
    expected: {
      distanceKm: 30,
      driveMinutes: 30,
      legIds: ['bc', 'ab'],
      mapNodeIds: ['c', 'b', 'a'],
    },
    from: 'c',
    legs: [
      { distanceKm: 10, driveMinutes: 10, from: 'a', id: 'ab', to: 'b' },
      { distanceKm: 20, driveMinutes: 20, from: 'b', id: 'bc', to: 'c' },
    ],
    name: 'walks a leg against its direction',
    to: 'a',
  },
];

describe('findRoute', () => {
  for (const routeCase of ROUTE_CASES) {
    it(routeCase.name, () => {
      const graph = createRouteGraph(createLegs(routeCase.legs));

      expect(findRoute(graph, routeCase.from, routeCase.to)).toEqual(routeCase.expected);
    });
  }

  it('returns a zero route for the start itself', () => {
    const graph = createRouteGraph(createLegs([
      { distanceKm: 10, driveMinutes: 10, from: 'a', id: 'ab', to: 'b' },
    ]));

    expect(findRoute(graph, 'a', 'a')).toEqual({
      distanceKm: 0,
      driveMinutes: 0,
      legIds: [],
      mapNodeIds: ['a'],
    });
  });

  it('returns undefined for an unreachable map node', () => {
    const graph = createRouteGraph(createLegs([
      { distanceKm: 10, driveMinutes: 10, from: 'a', id: 'ab', to: 'b' },
      { distanceKm: 10, driveMinutes: 10, from: 'x', id: 'xy', to: 'y' },
    ]));

    expect(findRoute(graph, 'a', 'x')).toBeUndefined();
    expect(findRoute(graph, 'a', 'unknown')).toBeUndefined();
  });

  it('does not depend on the order of legs', () => {
    const legs = createLegs([
      { distanceKm: 50, driveMinutes: 50, from: 'a', id: 'ad', to: 'd' },
      { distanceKm: 50, driveMinutes: 50, from: 'd', id: 'dc', to: 'c' },
      { distanceKm: 50, driveMinutes: 50, from: 'a', id: 'ab', to: 'b' },
      { distanceKm: 50, driveMinutes: 50, from: 'b', id: 'bc', to: 'c' },
      { distanceKm: 10, driveMinutes: 10, from: 'c', id: 'ce', to: 'e' },
    ]);
    const expected = findRoutesFrom(createRouteGraph(legs), 'a');

    for (const shift of [1, 2, 3, 4]) {
      const rotated = [...legs.slice(shift), ...legs.slice(0, shift)];

      expect(findRoutesFrom(createRouteGraph(rotated), 'a')).toEqual(expected);
      expect(findRoutesFrom(createRouteGraph([...rotated].reverse()), 'a')).toEqual(expected);
    }
  });
});

describe('findRoutesFrom', () => {
  it('returns routes to every reachable map node including the start', () => {
    const graph = createRouteGraph(createLegs([
      { distanceKm: 10, driveMinutes: 10, from: 'a', id: 'ab', to: 'b' },
      { distanceKm: 20, driveMinutes: 20, from: 'b', id: 'bc', to: 'c' },
      { distanceKm: 5, driveMinutes: 5, from: 'x', id: 'xy', to: 'y' },
    ]));

    const routes = findRoutesFrom(graph, 'a');

    expect([...routes.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns an empty map for a start that is not in the graph', () => {
    const graph = createRouteGraph(createLegs([
      { distanceKm: 10, driveMinutes: 10, from: 'a', id: 'ab', to: 'b' },
    ]));

    expect(findRoutesFrom(graph, 'unknown').size).toBe(0);
    expect(findRoutesFrom(createRouteGraph([]), 'a').size).toBe(0);
  });
});

describe('seed route graph', () => {
  const graph = createRouteGraph(createSeedRouteLegs());

  it('chooses the direct leg from Moscow to Kazan over the way through Nizhny Novgorod', () => {
    expect(findRoute(graph, SeedMapNodeId.MOSCOW, SeedMapNodeId.KAZAN)).toEqual({
      distanceKm: 820,
      driveMinutes: 600,
      legIds: [SeedRouteLegId.MOSCOW_KAZAN],
      mapNodeIds: [SeedMapNodeId.MOSCOW, SeedMapNodeId.KAZAN],
    });
  });

  it('finds the same way from Kazan to Moscow', () => {
    expect(findRoute(graph, SeedMapNodeId.KAZAN, SeedMapNodeId.MOSCOW)).toEqual({
      distanceKm: 820,
      driveMinutes: 600,
      legIds: [SeedRouteLegId.MOSCOW_KAZAN],
      mapNodeIds: [SeedMapNodeId.KAZAN, SeedMapNodeId.MOSCOW],
    });
  });

  it('finds Krasnodar to Moscow through Voronezh', () => {
    expect(findRoute(graph, SeedMapNodeId.KRASNODAR, SeedMapNodeId.MOSCOW)).toEqual({
      distanceKm: 1270,
      driveMinutes: 970,
      legIds: [SeedRouteLegId.VORONEZH_KRASNODAR, SeedRouteLegId.MOSCOW_VORONEZH],
      mapNodeIds: [SeedMapNodeId.KRASNODAR, SeedMapNodeId.VORONEZH, SeedMapNodeId.MOSCOW],
    });
  });

  it('reaches Krasnodar from Novosibirsk', () => {
    const route = findRoute(graph, SeedMapNodeId.NOVOSIBIRSK, SeedMapNodeId.KRASNODAR);

    expect(route).toBeDefined();
    expect(route?.mapNodeIds[0]).toBe(SeedMapNodeId.NOVOSIBIRSK);
    expect(route?.mapNodeIds.at(-1)).toBe(SeedMapNodeId.KRASNODAR);
  });

  it('reaches all nine map nodes from Moscow', () => {
    expect(findRoutesFrom(graph, SeedMapNodeId.MOSCOW).size).toBe(9);
  });
});
