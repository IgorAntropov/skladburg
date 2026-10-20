import type { ServiceImpl } from '@connectrpc/connect';

import { create } from '@bufbuild/protobuf';
import {
  ListBoardNodesResponseSchema,
  ListCitiesResponseSchema,
  NetworkService,
} from '@skladburg/contracts/network/v1/network';

import type { IModuleRuntime } from '../moduleRuntime';

import { paginate } from '../pagination';

export const createNetworkService = (runtime: IModuleRuntime): ServiceImpl<typeof NetworkService> => {
  const { errors, guard, read } = runtime;

  return {
    listBoardNodes: (request, context) => {
      guard.guardCall(read, NetworkService.method.listBoardNodes, request, context.requestHeader);
      const { items, page } = paginate(read.list('boardNodes'), node => node.id, request.page, errors);

      return create(ListBoardNodesResponseSchema, { boardNodes: items, page });
    },
    listCities: (request, context) => {
      guard.guardCall(read, NetworkService.method.listCities, request, context.requestHeader);
      const { items, page } = paginate(read.list('cities'), city => city.id, request.page, errors);

      return create(ListCitiesResponseSchema, { cities: items, page });
    },
  };
};
