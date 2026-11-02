import type { RouteLeg } from '@skladburg/contracts/network/v1/network';

import { compareIds } from '../../state/index';

export interface RouteGraphValue {
  edgesByMapNodeId: ReadonlyMap<string, readonly RouteEdgeValue[]>;
}

export interface RouteValue {
  distanceKm: number;
  driveMinutes: number;
  legIds: readonly string[];
  mapNodeIds: readonly string[];
}

interface RouteEdgeValue {
  distanceKm: number;
  driveMinutes: number;
  legId: string;
  toMapNodeId: string;
}

const compareLegIds = (current: readonly string[], prev: readonly string[]): number => {
  const sharedLength = Math.min(current.length, prev.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const result = compareIds(current[index] ?? '', prev[index] ?? '');

    if (result !== 0) {
      return result;
    }
  }

  return current.length - prev.length;
};

const compareRoutes = (current: RouteValue, prev: RouteValue): number => {
  if (current.distanceKm !== prev.distanceKm) {
    return current.distanceKm - prev.distanceKm;
  }

  if (current.driveMinutes !== prev.driveMinutes) {
    return current.driveMinutes - prev.driveMinutes;
  }

  return compareLegIds(current.legIds, prev.legIds);
};

const addEdge = (
  edgesByMapNodeId: Map<string, RouteEdgeValue[]>,
  fromMapNodeId: string,
  edge: RouteEdgeValue,
): void => {
  const edges = edgesByMapNodeId.get(fromMapNodeId);

  if (edges) {
    edges.push(edge);

    return;
  }

  edgesByMapNodeId.set(fromMapNodeId, [edge]);
};

export const createRouteGraph = (legs: readonly RouteLeg[]): RouteGraphValue => {
  const edgesByMapNodeId = new Map<string, RouteEdgeValue[]>();

  for (const leg of legs) {
    const { distanceKm, driveMinutes } = leg;

    addEdge(edgesByMapNodeId, leg.fromMapNodeId, {
      distanceKm,
      driveMinutes,
      legId: leg.id,
      toMapNodeId: leg.toMapNodeId,
    });
    addEdge(edgesByMapNodeId, leg.toMapNodeId, {
      distanceKm,
      driveMinutes,
      legId: leg.id,
      toMapNodeId: leg.fromMapNodeId,
    });
  }

  return { edgesByMapNodeId };
};

const extendRoute = (route: RouteValue, edge: RouteEdgeValue): RouteValue => ({
  distanceKm: route.distanceKm + edge.distanceKm,
  driveMinutes: route.driveMinutes + edge.driveMinutes,
  legIds: [...route.legIds, edge.legId],
  mapNodeIds: [...route.mapNodeIds, edge.toMapNodeId],
});

const pickNearestMapNodeId = (
  routes: ReadonlyMap<string, RouteValue>,
  settledMapNodeIds: ReadonlySet<string>,
): string | undefined => {
  let nearestMapNodeId: string | undefined;
  let nearestRoute: RouteValue | undefined;

  for (const [mapNodeId, route] of routes) {
    if (settledMapNodeIds.has(mapNodeId)) {
      continue;
    }

    if (!nearestRoute || compareRoutes(route, nearestRoute) < 0) {
      nearestMapNodeId = mapNodeId;
      nearestRoute = route;
    }
  }

  return nearestMapNodeId;
};

export const findRoutesFrom = (
  graph: RouteGraphValue,
  fromMapNodeId: string,
): ReadonlyMap<string, RouteValue> => {
  const routes = new Map<string, RouteValue>();

  if (!graph.edgesByMapNodeId.has(fromMapNodeId)) {
    return routes;
  }

  const settledMapNodeIds = new Set<string>();

  routes.set(fromMapNodeId, {
    distanceKm: 0,
    driveMinutes: 0,
    legIds: [],
    mapNodeIds: [fromMapNodeId],
  });

  let currentMapNodeId = pickNearestMapNodeId(routes, settledMapNodeIds);

  while (currentMapNodeId !== undefined) {
    const currentRoute = routes.get(currentMapNodeId);

    settledMapNodeIds.add(currentMapNodeId);

    if (currentRoute) {
      for (const edge of graph.edgesByMapNodeId.get(currentMapNodeId) ?? []) {
        if (settledMapNodeIds.has(edge.toMapNodeId)) {
          continue;
        }

        const candidate = extendRoute(currentRoute, edge);
        const known = routes.get(edge.toMapNodeId);

        if (!known || compareRoutes(candidate, known) < 0) {
          routes.set(edge.toMapNodeId, candidate);
        }
      }
    }

    currentMapNodeId = pickNearestMapNodeId(routes, settledMapNodeIds);
  }

  return routes;
};

export const findRoute = (
  graph: RouteGraphValue,
  fromMapNodeId: string,
  toMapNodeId: string,
): RouteValue | undefined => findRoutesFrom(graph, fromMapNodeId).get(toMapNodeId);
