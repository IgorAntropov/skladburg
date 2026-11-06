import type { Page } from '@playwright/test';

import { createEngineWorkerRobot } from './engine-worker-robot.ts';

export interface ImportWorkerRobotValue {
  call: (method: string, body: Uint8Array) => Promise<Uint8Array>;
  hasLoadedXlsxReader: () => boolean;
  stop: () => Promise<void>;
}

export const createImportWorkerRobot = async (page: Page): Promise<ImportWorkerRobotValue> => {
  const worker = await createEngineWorkerRobot(page);

  return {
    call: (method, body) => worker.call(`import.v1.ImportService/${method}`, body),
    hasLoadedXlsxReader: () => worker.hasRequestedChunk('xlsxReader'),
    stop: worker.stop,
  };
};
