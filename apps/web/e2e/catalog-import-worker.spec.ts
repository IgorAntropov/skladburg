import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  CommitImportRequestSchema,
  CommitImportResponseSchema,
  GetImportJobRequestSchema,
  GetImportJobResponseSchema,
  GetImportTemplateRequestSchema,
  GetImportTemplateResponseSchema,
  ImportStatus,
  PreviewImportRequestSchema,
  PreviewImportResponseSchema,
  RollbackImportRequestSchema,
  RollbackImportResponseSchema,
} from '@skladburg/contracts/import/v1/import';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  expect,
  test,
} from './fixtures/test.ts';
import { createImportWorkerRobot } from './robots/import-worker-robot.ts';

test('previews, commits and rolls back XLSX through the production Worker', async ({ page }) => {
  const worker = await createImportWorkerRobot(page);

  try {
    const templateResponse = fromBinary(GetImportTemplateResponseSchema, await worker.call('GetImportTemplate',
      toBinary(GetImportTemplateRequestSchema, create(GetImportTemplateRequestSchema, { templateId: 'catalog' })),
    ));
    expect(templateResponse.template?.columns.some(column => column.key === 'price_rub')).toBe(true);
    expect(worker.hasLoadedXlsxReader()).toBe(false);

    const previewResponse = fromBinary(PreviewImportResponseSchema, await worker.call('PreviewImport',
      toBinary(PreviewImportRequestSchema, create(PreviewImportRequestSchema, {
        fileBytes: readFileSync(new URL('./fixtures/catalog-import.xlsx', import.meta.url)),
        fileName: 'catalog.xlsx',
        idempotencyKey: randomUUID(),
        templateId: 'catalog',
      })),
    ));
    expect(worker.hasLoadedXlsxReader()).toBe(true);
    expect(previewResponse.job).toMatchObject({ errorCount: 0, rowCount: 1, status: ImportStatus.PREVIEW });
    const job = previewResponse.job;

    if (job === undefined) {
      throw new Error('Preview must return the import job');
    }

    const detailResponse = fromBinary(GetImportJobResponseSchema, await worker.call('GetImportJob',
      toBinary(GetImportJobRequestSchema, create(GetImportJobRequestSchema, { jobId: job.id })),
    ));
    expect(detailResponse.rows).toHaveLength(1);
    expect(detailResponse.rows[0]?.product?.sku).toBe('IMPORT-WORKER-001');
    expect(detailResponse.rows[0]?.price?.tiers[0]?.price?.amountMinor).toBe(12345n);

    const committedResponse = fromBinary(CommitImportResponseSchema, await worker.call('CommitImport',
      toBinary(CommitImportRequestSchema, create(CommitImportRequestSchema, {
        expectedVersion: job.version,
        idempotencyKey: randomUUID(),
        jobId: job.id,
      })),
    ));
    expect(committedResponse.job?.status).toBe(ImportStatus.COMMITTED);
    const committed = committedResponse.job;

    if (committed === undefined) {
      throw new Error('Commit must return the import job');
    }

    const rolledBackResponse = fromBinary(RollbackImportResponseSchema, await worker.call('RollbackImport',
      toBinary(RollbackImportRequestSchema, create(RollbackImportRequestSchema, {
        expectedVersion: committed.version,
        idempotencyKey: randomUUID(),
        jobId: job.id,
      })),
    ));
    expect(rolledBackResponse.job?.status).toBe(ImportStatus.ROLLED_BACK);
  }
  finally {
    await worker.stop();
  }
});

test('previews CSV without loading the XLSX reader', async ({ page }) => {
  const worker = await createImportWorkerRobot(page);

  try {
    const previewResponse = fromBinary(PreviewImportResponseSchema, await worker.call('PreviewImport',
      toBinary(PreviewImportRequestSchema, create(PreviewImportRequestSchema, {
        fileBytes: readFileSync(new URL('./fixtures/catalog-import.csv', import.meta.url)),
        fileName: 'catalog.csv',
        idempotencyKey: randomUUID(),
        templateId: 'catalog',
      })),
    ));
    expect(previewResponse.job).toMatchObject({ errorCount: 0, rowCount: 1, status: ImportStatus.PREVIEW });
    expect(worker.hasLoadedXlsxReader()).toBe(false);
  }
  finally {
    await worker.stop();
  }
});
