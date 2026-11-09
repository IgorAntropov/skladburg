import type { Page } from '@playwright/test';

import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  GetImportJobRequestSchema,
  GetImportJobResponseSchema,
  PreviewImportRequestSchema,
  PreviewImportResponseSchema,
} from '@skladburg/contracts/import/v1/import';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';

import {
  expect,
  test,
} from './fixtures/test.ts';
import {
  changeStoredEngineMetadata,
  readStoredEngineSnapshot,
} from './robots/engine-storage-robot.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';

const SEED_REQUEST = '**/assets/seedSnapshot-*.js';
const DEAL_HISTORY_REQUEST = '**/assets/seedDealHistory-*.js';

const createStoredImport = async (page: Page): Promise<string> => {
  const worker = await createEngineWorkerRobot(page);

  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect(worker.hasRequestedChunk('seedSnapshot')).toBe(true);
    expect(worker.hasRequestedChunk('seedDealHistory')).toBe(true);
    const response = fromBinary(PreviewImportResponseSchema, await worker.call('import.v1.ImportService/PreviewImport',
      toBinary(PreviewImportRequestSchema, create(PreviewImportRequestSchema, {
        fileBytes: readFileSync(new URL('./fixtures/catalog-import.csv', import.meta.url)),
        fileName: 'catalog.csv',
        idempotencyKey: randomUUID(),
        templateId: 'catalog',
      })),
    ));
    expect(response.job?.errorCount).toBe(0);

    if (response.job === undefined) {
      throw new Error('Preview must persist the import job');
    }

    return response.job.id;
  }
  finally {
    await worker.stop();
  }
};

const expectStoredImport = async (worker: EngineWorkerRobotValue, jobId: string): Promise<void> => {
  const response = fromBinary(GetImportJobResponseSchema, await worker.call('import.v1.ImportService/GetImportJob',
    toBinary(GetImportJobRequestSchema, create(GetImportJobRequestSchema, { jobId })),
  ));
  expect(response.job?.id).toBe(jobId);
  expect(response.rows).toHaveLength(1);
};

test('loads the seed for a fresh world and restores saved changes without the seed chunk', async ({ page }) => {
  const jobId = await createStoredImport(page);
  await page.context().route(SEED_REQUEST, route => route.abort('failed'));
  await page.context().route(DEAL_HISTORY_REQUEST, route => route.abort('failed'));
  const restored = await createEngineWorkerRobot(page);

  try {
    await expect.poll(restored.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    await expectStoredImport(restored, jobId);
    expect(restored.hasRequestedChunk('seedSnapshot')).toBe(false);
    expect(restored.hasRequestedChunk('seedDealHistory')).toBe(false);
  }
  finally {
    await restored.stop();
  }
});

test('preserves an obsolete world when the seed chunk fails and recovers after restarting the Worker', async ({ page }) => {
  await createStoredImport(page);
  await changeStoredEngineMetadata(page, { isClockPaused: true, seedVersionOffset: -1 });
  const snapshot = await readStoredEngineSnapshot(page);
  await page.context().route(SEED_REQUEST, route => route.abort('failed'));
  const failed = await createEngineWorkerRobot(page);

  try {
    await expect.poll(failed.readStartup).toEqual({ kind: 'unavailable' });
    expect(failed.hasRequestedChunk('seedSnapshot')).toBe(true);
    expect(await readStoredEngineSnapshot(page)).toBe(snapshot);
  }
  finally {
    await failed.stop();
  }

  await page.context().unroute(SEED_REQUEST);
  const recovered = await createEngineWorkerRobot(page);

  try {
    await expect.poll(recovered.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect(recovered.hasRequestedChunk('seedSnapshot')).toBe(true);
    expect(await readStoredEngineSnapshot(page)).not.toBe(snapshot);
  }
  finally {
    await recovered.stop();
  }
});

test('keeps the restored world and epoch on a failed reset and retries in the same Worker', async ({ page }) => {
  const jobId = await createStoredImport(page);
  await changeStoredEngineMetadata(page, { isClockPaused: true, seedVersionOffset: 0 });
  await page.context().route(SEED_REQUEST, route => route.abort('failed'));
  const restored = await createEngineWorkerRobot(page);

  try {
    await expect.poll(restored.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    const status = await restored.readStartup();
    const snapshot = await readStoredEngineSnapshot(page);
    expect(restored.hasRequestedChunk('seedSnapshot')).toBe(false);
    expect(await restored.reset()).toBe('transport_error');
    expect(restored.hasRequestedChunk('seedSnapshot')).toBe(true);
    expect(await restored.readStartup()).toEqual(status);
    expect(await restored.hasReset()).toBe(false);
    expect(await readStoredEngineSnapshot(page)).toBe(snapshot);
    await expectStoredImport(restored, jobId);

    await page.context().unroute(SEED_REQUEST);
    expect(await restored.reset()).toBe('control_result');
    expect(await restored.hasReset()).toBe(true);
    expect(await restored.readStartup()).not.toEqual(status);
  }
  finally {
    await restored.stop();
  }
});
