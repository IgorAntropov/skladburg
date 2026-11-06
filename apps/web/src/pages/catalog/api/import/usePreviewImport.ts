import type { ImportJob } from '@skladburg/contracts/import/v1/import';

import { ImportService } from '@skladburg/contracts/import/v1/import';
import {
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import type {
  CommandAccessValue,
  CommandValue,
} from '@/shared/api';

import {
  useApiClient,
  useCommand,
} from '@/shared/api';

import type { ImportFileErrorValue } from './importFile';

import { readImportFile } from './importFile';
import {
  IMPORT_TEMPLATE_ID,
  useImportWriteAccess,
  useRefreshImports,
} from './useImportQueries';

interface PreparedImportValue {
  bytes: Uint8Array<ArrayBuffer>;
  name: string;
}

interface PreviewImportValue {
  access: CommandAccessValue;
  command: CommandValue;
  fileError: ImportFileErrorValue | undefined;
  fileName: string | undefined;
  isReading: boolean;
  selectFile: (file: File) => void;
}

export const usePreviewImport = (onPreview: (job: ImportJob) => void): PreviewImportValue => {
  const client = useApiClient();
  const access = useImportWriteAccess(ImportService.method.previewImport);
  const refresh = useRefreshImports();
  const isMounted = useRef(false);
  const preparedFile = useRef<PreparedImportValue | undefined>(undefined);
  const [fileError, setFileError] = useState<ImportFileErrorValue | undefined>(undefined);
  const [fileName, setFileName] = useState<string | undefined>(undefined);
  const [isReading, setIsReading] = useState(false);

  const command = useCommand({
    execute: async (idempotencyKey): Promise<ImportJob> => {
      const file = preparedFile.current;
      if (file === undefined || !isMounted.current) {
        throw new Error('No file selected for import');
      }

      const response = await client.service(ImportService).previewImport({
        fileBytes: file.bytes,
        fileName: file.name,
        idempotencyKey,
        templateId: IMPORT_TEMPLATE_ID,
      });
      if (response.job === undefined) {
        throw new Error('PreviewImport response has no job');
      }

      return response.job;
    },
    method: ImportService.method.previewImport,
    onSuccess: (job) => {
      refresh();
      if (isMounted.current) {
        preparedFile.current = undefined;
        setFileName(undefined);
        onPreview(job);
      }
    },
  });

  const selectFile = (file: File): void => {
    command.reset();
    preparedFile.current = undefined;
    setFileError(undefined);
    setFileName(undefined);
    setIsReading(true);

    void readImportFile(file).then((result) => {
      if (!isMounted.current) {
        return;
      }

      setIsReading(false);
      if (typeof result === 'string') {
        setFileError(result);
        return;
      }

      preparedFile.current = { bytes: result, name: file.name };
      setFileName(file.name);
    });
  };

  useLayoutEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return { access, command, fileError, fileName, isReading, selectFile };
};
