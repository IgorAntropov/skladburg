import type { DescMethod } from '@bufbuild/protobuf';
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

import { CatalogService } from '@skladburg/contracts/catalog/v1/catalog';
import { ImportService } from '@skladburg/contracts/import/v1/import';
import {
  skipToken,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { PermissionScopeValue } from '@/entities/session';
import type { CommandAccessValue } from '@/shared/api';

import { useCommandAccess } from '@/entities/session';
import {
  createOrganizationQueryMeta,
  useActingContext,
  useApiClient,
} from '@/shared/api';

export const IMPORT_TEMPLATE_ID = 'catalog';

export const IMPORT_SCOPE = { kind: 'organization' } satisfies PermissionScopeValue;

const getNextPage = (response: GetImportJobResponse | ListImportJobsResponse): string | undefined => {
  const token = response.page?.nextPageToken;
  return token === '' ? undefined : token;
};

const useImportScope = (): readonly ['catalog-import', string | undefined, string | undefined] => {
  const { organizationId, userId } = useActingContext();
  return ['catalog-import', organizationId, userId];
};

export const useImportReadAccess = (): CommandAccessValue => {
  const access = useCommandAccess(ImportService.method.listImportJobs, IMPORT_SCOPE);
  const catalog = useCommandAccess(CatalogService.method.listProducts, IMPORT_SCOPE);
  const price = useCommandAccess(CatalogService.method.listListingPrices, IMPORT_SCOPE);

  return [access, catalog, price].find(value => value.status !== 'allowed') ?? access;
};

export const useImportWriteAccess = (method: DescMethod): CommandAccessValue => {
  const access = useCommandAccess(method, IMPORT_SCOPE);
  const catalog = useCommandAccess(CatalogService.method.saveProduct, IMPORT_SCOPE);
  const price = useCommandAccess(CatalogService.method.saveListingPrice, IMPORT_SCOPE);

  return [access, catalog, price].find(value => value.status !== 'allowed') ?? access;
};

export const useImportTemplate = (): UseQueryResult<ImportTemplate> => {
  const client = useApiClient();
  const scope = useImportScope();

  return useQuery({
    queryFn: async ({ signal }) => {
      const response = await client.service(ImportService).getImportTemplate({ templateId: IMPORT_TEMPLATE_ID }, { signal });
      if (response.template === undefined) {
        throw new Error('GetImportTemplate response has no template');
      }

      return response.template;
    },
    queryKey: [...scope, 'template'],
    staleTime: Infinity,
  });
};

export const useImportHistory = (): UseInfiniteQueryResult<InfiniteData<ListImportJobsResponse, string>> => {
  const client = useApiClient();
  const scope = useImportScope();
  const organizationId = scope[1];

  return useInfiniteQuery({
    getNextPageParam: getNextPage,
    initialPageParam: '',
    meta: createOrganizationQueryMeta(organizationId, ['listingsChanged']),
    queryFn: ({ pageParam, signal }) => client.service(ImportService).listImportJobs({
      page: { pageSize: 12, pageToken: pageParam },
    }, { signal }),
    queryKey: [...scope, 'jobs'],
  });
};

export const useImportRows = (
  jobId: string | undefined,
  hasErrorsOnly: boolean,
): UseInfiniteQueryResult<InfiniteData<GetImportJobResponse, string>> => {
  const client = useApiClient();
  const scope = useImportScope();
  const organizationId = scope[1];

  return useInfiniteQuery({
    getNextPageParam: getNextPage,
    initialPageParam: '',
    meta: createOrganizationQueryMeta(organizationId, ['listingsChanged']),
    queryFn: jobId === undefined
      ? skipToken
      : ({ pageParam, signal }) => client.service(ImportService).getImportJob({
          hasErrorsOnly,
          jobId,
          page: { pageSize: 12, pageToken: pageParam },
        }, { signal }),
    queryKey: [...scope, 'rows', jobId, hasErrorsOnly],
  });
};

export const useRefreshImports = (): (() => void) => {
  const scope = useImportScope();
  const queryClient = useQueryClient();

  return (): void => {
    void queryClient.invalidateQueries({ queryKey: [...scope, 'jobs'] });
    void queryClient.invalidateQueries({ queryKey: [...scope, 'rows'] });
  };
};
