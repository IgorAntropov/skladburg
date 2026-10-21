import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import {
  ListCitiesResponseSchema,
  ListMapNodesResponseSchema,
  ListMapSitesResponseSchema,
  ListRouteLegsResponseSchema,
  NetworkService,
} from '@skladburg/contracts/network/v1/network';

import type { IModuleRuntime } from '../moduleRuntime';

import { listVisibleMapSites } from '../../visibility/index';
import { paginate } from '../pagination';

export const createNetworkService = (runtime: IModuleRuntime): ServiceImpl<typeof NetworkService> => {
  const { errors, guard, read } = runtime;

  return {
    listCities: (request, context) => {
      guard.guardCall(read, NetworkService.method.listCities, request, context.requestHeader);
      const { items, page } = paginate(read.list('cities'), city => city.id, request.page, errors);

      return create(ListCitiesResponseSchema, { cities: items, page });
    },
    listMapNodes: (request, context) => {
      guard.guardCall(read, NetworkService.method.listMapNodes, request, context.requestHeader);
      const { items, page } = paginate(read.list('mapNodes'), node => node.id, request.page, errors);

      return create(ListMapNodesResponseSchema, { mapNodes: items, page });
    },
    listMapSites: (request, context) => {
      const caller = guard.guardPermissionCall(read, NetworkService.method.listMapSites, request, context.requestHeader);
      const sites = listVisibleMapSites(read, caller.organizationId);
      const { items, page } = paginate(sites, site => site.id, request.page, errors);

      return create(ListMapSitesResponseSchema, { mapSites: items, page });
    },
    listRouteLegs: (request, context) => {
      guard.guardCall(read, NetworkService.method.listRouteLegs, request, context.requestHeader);
      const { items, page } = paginate(read.list('routeLegs'), leg => leg.id, request.page, errors);

      return create(ListRouteLegsResponseSchema, { page, routeLegs: items });
    },
  };
};
