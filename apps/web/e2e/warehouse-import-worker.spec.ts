import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  CommitImportRequestSchema,
  CommitImportResponseSchema,
  ImportStatus,
  PreviewImportRequestSchema,
  PreviewImportResponseSchema,
} from '@skladburg/contracts/import/v1/import';
import {
  ListStockMovementsRequestSchema,
  ListStockMovementsResponseSchema,
  StockMovementKind,
} from '@skladburg/contracts/wms/v1/stock';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { EngineWorkerRobotValue } from './robots/engine-worker-robot.ts';

import {
  expect,
  test,
} from './fixtures/test.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';

const WAREHOUSE_ID = '80000004-0000-4000-8000-000000000000';
const IMPORT_SERVICE = 'import.v1.ImportService';

const runImport = async (
  worker: EngineWorkerRobotValue,
  templateId: string,
  fixture: string,
): Promise<string> => {
  const warehouseScope = { templateId, warehouseId: WAREHOUSE_ID };
  const input = toBinary(PreviewImportRequestSchema, create(PreviewImportRequestSchema, {
    fileBytes: new Uint8Array(readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url))),
    fileName: fixture,
    idempotencyKey: randomUUID(),
    warehouseScope,
  }));
  const preview = fromBinary(PreviewImportResponseSchema, await worker.call(`${IMPORT_SERVICE}/PreviewImport`, input));
  expect(preview.job).toMatchObject({ errorCount: 0, status: ImportStatus.PREVIEW, warehouseId: WAREHOUSE_ID });

  const job = preview.job;
  if (job === undefined) {
    throw new Error('Missing preview job');
  }
  const commit = toBinary(CommitImportRequestSchema, create(CommitImportRequestSchema, {
    expectedVersion: job.version, idempotencyKey: randomUUID(), jobId: job.id, warehouseScope,
  }));
  const applied = fromBinary(CommitImportResponseSchema, await worker.call(`${IMPORT_SERVICE}/CommitImport`, commit));
  expect(applied.job?.status).toBe(ImportStatus.COMMITTED);
  return job.id;
};

test('imports both XLSX files and reopens the resulting journal from IndexedDB', async ({ page }) => {
  const worker = await createEngineWorkerRobot(page);
  let stockJobId: string;
  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect(worker.hasRequestedChunk('warehouseImport')).toBe(false);
    expect(worker.hasRequestedChunk('xlsxReader')).toBe(false);
    await runImport(worker, 'warehouse_cells', 'warehouse-import-cells.xlsx');
    stockJobId = await runImport(worker, 'opening_stock', 'warehouse-import-stock.xlsx');
    expect(worker.hasRequestedChunk('warehouseImport')).toBe(true);
    expect(worker.hasRequestedChunk('xlsxReader')).toBe(true);
  }
  finally {
    await worker.stop();
  }

  const reopened = await createEngineWorkerRobot(page);
  try {
    await expect.poll(reopened.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect(reopened.hasRequestedChunk('warehouseImport')).toBe(false);
    const input = toBinary(ListStockMovementsRequestSchema, create(ListStockMovementsRequestSchema, { warehouseId: WAREHOUSE_ID }));
    const response = fromBinary(
      ListStockMovementsResponseSchema,
      await reopened.call('wms.v1.WarehouseStockService/ListStockMovements', input),
    );
    expect(response.movements).toHaveLength(1);
    expect(response.movements[0]).toMatchObject({
      kind: StockMovementKind.OPENING_BALANCE,
      lines: [{ quantityBase: 9_007_199_254_740_993n }, { quantityBase: 2n }],
      sourceDocumentNumber: `IMP-${stockJobId}`,
    });
  }
  finally {
    await reopened.stop();
  }
});
