import type { ServiceImpl } from '@connectrpc/connect';
import type { DocumentService } from '@skladburg/contracts/document/v1/document';

import type { IModuleRuntime } from '../moduleRuntime';

export const loadDocuments = (): Promise<typeof import('./index')> => import('./index');

export const createDeferredDocumentService = (runtime: IModuleRuntime): ServiceImpl<typeof DocumentService> => {
  const service = (): Promise<ServiceImpl<typeof DocumentService>> =>
    loadDocuments().then(module => module.createDocumentService(runtime));

  return {
    getDocument: async (request, context) => (await service()).getDocument(request, context),
    listDealDocuments: async (request, context) => (await service()).listDealDocuments(request, context),
    signDocument: async (request, context) => (await service()).signDocument(request, context),
    signSupplyContract: async (request, context) => (await service()).signSupplyContract(request, context),
  };
};
