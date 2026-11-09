import type { Document } from '@skladburg/contracts/document/v1/document';
import type { Query } from '@tanstack/react-query';

import {
  DocumentService,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';
import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import type { CommandValue } from '@/shared/api';

import {
  isReadAccessDenied,
  useActingContext,
  useApiClient,
  useCommand,
} from '@/shared/api';

import {
  documentDetailKey,
  documentListKey,
  documentScopeKey,
} from './documentQueries';

interface SignDealDocumentOptionsValue {
  dealId: string;
  document: Document;
  onConfirmed: () => boolean;
}

type SignMethodNameValue = 'signDocument' | 'signSupplyContract';

interface SignRequestValue {
  dealId: string;
  documentId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

const getSignMethodName = (type: DocumentType): SignMethodNameValue =>
  type === DocumentType.SUPPLY_CONTRACT ? 'signSupplyContract' : 'signDocument';

export const getSignDealDocumentMethod = (type: DocumentType): typeof DocumentService.method[SignMethodNameValue] =>
  DocumentService.method[getSignMethodName(type)];

export const useSignDealDocument = ({ dealId, document, onConfirmed }: SignDealDocumentOptionsValue): CommandValue => {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { organizationId, userId } = useActingContext();
  const kind = getSignMethodName(document.type);
  const method = DocumentService.method[kind];
  const detailQueryRef = useRef<Query<Document> | undefined>(undefined);
  const requestRef = useRef<SignRequestValue | undefined>(undefined);
  const queryKey = documentScopeKey(organizationId, userId, dealId);
  const detailKey = documentDetailKey(queryKey, document.id);

  return useCommand({
    execute: async (idempotencyKey): Promise<Document> => {
      const request = requestRef.current?.idempotencyKey === idempotencyKey
        ? requestRef.current
        : { dealId, documentId: document.id, expectedVersion: document.version, idempotencyKey };
      requestRef.current = request;
      detailQueryRef.current = queryClient.getQueryCache().find<Document>({ exact: true, queryKey: detailKey });

      const result = await client.service(DocumentService)[kind](request);
      if (result.document === undefined) {
        throw new Error('Sign document response has no document');
      }

      return result.document;
    },
    method,
    mutationKey: ['command', ...queryKey, document.id, kind],
    onSuccess: (updated) => {
      const isViewMounted = onConfirmed();
      const listError = queryClient.getQueryState(documentListKey(queryKey))?.error ?? null;
      const current = queryClient.getQueryCache().find<Document>({ exact: true, queryKey: detailKey });
      const hasDeniedAccess = isReadAccessDenied(listError) || isReadAccessDenied(current?.state.error ?? null);

      if (isViewMounted && current !== undefined && current === detailQueryRef.current && !hasDeniedAccess) {
        queryClient.setQueryData<Document>(detailKey, prev => prev !== undefined && prev.version <= updated.version ? updated : undefined);
      }

      void queryClient.invalidateQueries({ queryKey });
    },
  });
};
