import type {
  GetImportJobResponse,
  ImportTemplate,
  ListImportJobsResponse,
} from '@skladburg/contracts/import/v1/import';
import type {
  InfiniteData,
  UseInfiniteQueryResult,
  UseQueryResult,
} from '@tanstack/react-query';

import { ImportService } from '@skladburg/contracts/import/v1/import';
import {
  inventoryChannel,
  warehouseChannel,
} from '@skladburg/contracts/runtime';
import {
  skipToken,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { ApiQueryMetaValue } from '@/shared/api';

import {
  createOrganizationQueryMeta,
  useActingContext,
  useApiClient,
} from '@/shared/api';

import type { ImportTargetValue } from '../model/importTarget';

import {
  getImportTemplateSelection,
  getImportWarehouseScope,
} from '../model/importTarget';

const getNextPage = (response: GetImportJobResponse | ListImportJobsResponse): string | undefined => {
  const token = response.page?.nextPageToken;
  return token === '' ? undefined : token;
};

export const useImportScope = (target: ImportTargetValue): readonly [
  'data-import', string | undefined, string | undefined, string | undefined, string,
] => {
  const { organizationId, userId } = useActingContext();

  return target.kind === 'warehouse'
    ? ['data-import', organizationId, userId, target.warehouseId, target.templateId]
    : ['data-import', organizationId, userId, undefined, 'catalog'];
};

const getImportQueryMeta = (target: ImportTargetValue, organizationId: string | undefined): ApiQueryMetaValue => {
  if (target.kind === 'catalog') {
    return createOrganizationQueryMeta(organizationId, ['listingsChanged']);
  }

  return target.templateId === 'warehouse_cells'
    ? { channels: [warehouseChannel(target.warehouseId)], eventCases: ['warehouseChanged'] }
    : { channels: [inventoryChannel(target.warehouseId)], eventCases: ['stockChanged'] };
};

export const useImportTemplate = (target: ImportTargetValue): UseQueryResult<ImportTemplate> => {
  const client = useApiClient();
  const scope = useImportScope(target);

  return useQuery({
    queryFn: async ({ signal }) => {
      const response = await client.service(ImportService).getImportTemplate(getImportTemplateSelection(target), { signal });
      if (response.template === undefined) {
        throw new Error('GetImportTemplate response has no template');
      }

      return response.template;
    },
    queryKey: [...scope, 'template'],
    staleTime: Infinity,
  });
};

export const useImportHistory = (target: ImportTargetValue): UseInfiniteQueryResult<InfiniteData<ListImportJobsResponse, string>> => {
  const client = useApiClient();
  const scope = useImportScope(target);
  const organizationId = scope[1];

  return useInfiniteQuery({
    getNextPageParam: getNextPage,
    initialPageParam: '',
    meta: getImportQueryMeta(target, organizationId),
    queryFn: ({ pageParam, signal }) => client.service(ImportService).listImportJobs({
      page: { pageSize: 12, pageToken: pageParam },
      warehouseScope: getImportWarehouseScope(target),
    }, { signal }),
    queryKey: [...scope, 'jobs'],
  });
};

export const useImportRows = (
  target: ImportTargetValue,
  jobId: string,
  hasErrorsOnly: boolean,
): UseInfiniteQueryResult<InfiniteData<GetImportJobResponse, string>> => {
  const client = useApiClient();
  const scope = useImportScope(target);
  const organizationId = scope[1];

  return useInfiniteQuery({
    getNextPageParam: getNextPage,
    initialPageParam: '',
    meta: getImportQueryMeta(target, organizationId),
    queryFn: jobId === ''
      ? skipToken
      : ({ pageParam, signal }) => client.service(ImportService).getImportJob({
          hasErrorsOnly,
          jobId,
          page: { pageSize: 12, pageToken: pageParam },
          warehouseScope: getImportWarehouseScope(target),
        }, { signal }),
    queryKey: [...scope, 'rows', jobId, hasErrorsOnly],
  });
};

export const useRefreshImports = (target: ImportTargetValue): (() => void) => {
  const scope = useImportScope(target);
  const queryClient = useQueryClient();

  return (): void => {
    void queryClient.invalidateQueries({ queryKey: [...scope, 'jobs'] });
    void queryClient.invalidateQueries({ queryKey: [...scope, 'rows'] });
  };
};
