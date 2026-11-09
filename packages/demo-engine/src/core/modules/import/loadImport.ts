import type { ServiceImpl } from '@connectrpc/connect';
import type { ImportService } from '@skladburg/contracts/import/v1/import';

import type { IRequestValidator } from '../../validation/index';
import type { IModuleRuntime } from '../moduleRuntime';

export const createDeferredImportService = (
  runtime: IModuleRuntime,
  validator: IRequestValidator,
): ServiceImpl<typeof ImportService> => {
  const service = (): Promise<ServiceImpl<typeof ImportService>> =>
    import('./importService').then(module => module.createImportService(runtime, validator));

  return {
    commitImport: async (request, context) => (await service()).commitImport(request, context),
    getImportJob: async (request, context) => (await service()).getImportJob(request, context),
    getImportTemplate: async (request, context) => (await service()).getImportTemplate(request, context),
    listImportJobs: async (request, context) => (await service()).listImportJobs(request, context),
    previewImport: async (request, context) => (await service()).previewImport(request, context),
    rollbackImport: async (request, context) => (await service()).rollbackImport(request, context),
  };
};
