import type { Document } from '@skladburg/contracts/document/v1/document';
import type { UseQueryResult } from '@tanstack/react-query';

import { DocumentService } from '@skladburg/contracts/document/v1/document';
import { dealChannel } from '@skladburg/contracts/runtime';
import {
  skipToken,
  useQuery,
} from '@tanstack/react-query';

import type {
  ApiClient,
  ApiQueryMetaValue,
} from '@/shared/api';

import {
  collectPages,
  createOrganizationQueryMeta,
  getOrganizationScope,
  useActingContext,
  useApiClient,
} from '@/shared/api';

export type DocumentSummaryValue = Pick<Document, 'date' | 'displayNumber' | 'id' | 'number' | 'status' | 'type'>;

export const documentScopeKey = (organizationId: string | undefined, userId: string | undefined, dealId: string): readonly string[] =>
  ['documents', getOrganizationScope(organizationId), userId ?? '', dealId];

export const documentDetailKey = (scope: readonly string[], documentId: string): readonly string[] => [...scope, 'detail', documentId];

export const documentListKey = (scope: readonly string[]): readonly string[] => [...scope, 'list'];

const createDocumentQueryMeta = (organizationId: string | undefined, dealId: string): ApiQueryMetaValue => {
  const meta = createOrganizationQueryMeta(organizationId, ['dealChanged']);

  return organizationId === undefined ? meta : { ...meta, channels: [...(meta.channels ?? []), dealChannel(dealId)] };
};

export const fetchDealDocuments = async (client: ApiClient, dealId: string, signal?: AbortSignal): Promise<DocumentSummaryValue[]> =>
  collectPages(async (page) => {
    const response = await client.service(DocumentService).listDealDocuments({ dealId, page }, { signal });
    const items = response.documents.map(({ date, displayNumber, id, number, status, type }) => ({
      date,
      displayNumber,
      id,
      number,
      status,
      type,
    }));

    return { items, nextPageToken: response.page?.nextPageToken ?? '' };
  });

export const documentListMethod = DocumentService.method.listDealDocuments;

export const useDealDocumentsQuery = (dealId: string): UseQueryResult<DocumentSummaryValue[]> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  return useQuery({
    meta: createDocumentQueryMeta(organizationId, dealId),
    queryFn: organizationId !== undefined && userId !== undefined ? ({ signal }) => fetchDealDocuments(client, dealId, signal) : skipToken,
    queryKey: documentListKey(documentScopeKey(organizationId, userId, dealId)),
  });
};

export const useDealDocumentQuery = (dealId: string, documentId: string): UseQueryResult<Document> => {
  const client = useApiClient();
  const { organizationId, userId } = useActingContext();

  return useQuery({
    meta: createDocumentQueryMeta(organizationId, dealId),
    queryFn: organizationId !== undefined && userId !== undefined
      ? async ({ signal }): Promise<Document> => {
        const { document } = await client.service(DocumentService).getDocument({ dealId, documentId }, { signal });

        if (document === undefined) {
          throw new Error('Document response has no document');
        }

        return document;
      }
      : skipToken,
    queryKey: documentDetailKey(documentScopeKey(organizationId, userId, dealId), documentId),
  });
};
