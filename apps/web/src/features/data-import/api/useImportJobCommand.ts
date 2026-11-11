import type { ImportJob } from '@skladburg/contracts/import/v1/import';

import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  ImportService,
  ImportStatus,
} from '@skladburg/contracts/import/v1/import';

import type {
  CommandAccessValue,
  CommandValue,
} from '@/shared/api';

import {
  useApiClient,
  useCommand,
} from '@/shared/api';

import type { ImportOptionsValue } from '../model/importOptions';

import { getImportWarehouseScope } from '../model/importTarget';
import { useImportAccess } from './useImportAccess';
import { useRefreshImports } from './useImportQueries';

interface ImportJobCommandValue {
  access: CommandAccessValue;
  command: CommandValue;
  reload: () => void;
}

export const useImportJobCommand = (
  { target, writeAccess }: Pick<ImportOptionsValue, 'target' | 'writeAccess'>,
  job: ImportJob,
  onSuccess: (job: ImportJob) => void,
): ImportJobCommandValue => {
  const client = useApiClient();
  const refresh = useRefreshImports(target);
  const isCommit = job.status === ImportStatus.PREVIEW;
  const method = isCommit ? ImportService.method.commitImport : ImportService.method.rollbackImport;
  const access = useImportAccess(method, writeAccess);

  const command = useCommand({
    execute: async (idempotencyKey): Promise<ImportJob> => {
      const service = client.service(ImportService);
      const input = {
        expectedVersion: job.version,
        idempotencyKey,
        jobId: job.id,
        warehouseScope: getImportWarehouseScope(target),
      };
      const response = await (isCommit ? service.commitImport(input) : service.rollbackImport(input));
      if (response.job === undefined) {
        throw new Error('Import command response has no job');
      }

      return response.job;
    },
    method,
    onSuccess: (updatedJob) => {
      onSuccess(updatedJob);
      refresh();
    },
  });

  const reload = (): void => {
    if (command.apiError?.code === ErrorCode.VERSION_CONFLICT) {
      refresh();
    }
  };

  return { access, command, reload };
};
