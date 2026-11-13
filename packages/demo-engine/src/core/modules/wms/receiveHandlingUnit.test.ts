import type { MessageInitShape } from '@bufbuild/protobuf';
import type { ReceivingBatchEvidenceSchema } from '@skladburg/contracts/wms/v1/receiving';

import { create } from '@bufbuild/protobuf';
import {
  BaseUnit,
  MarkingMode,
} from '@skladburg/contracts/catalog/v1/catalog';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import {
  ReceiveHandlingUnitRequestSchema,
  ReceivingTaskSchema,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  HandlingUnitKind,
  StockStatus,
} from '@skladburg/contracts/wms/v1/stock';
import {
  expect,
  it,
} from 'vitest';

import {
  SeedOrganizationId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { nextUuid } from '../catalog/testing/catalogFixtures';
import {
  addTestMember,
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import { receiveHandlingUnit } from './receiveHandlingUnit';

const WAREHOUSE = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1;
const TENANT = SeedOrganizationId.CUSTOMER_1;
const FIRST_SSCC = '000000000000000017';
const SECOND_SSCC = '000000000000000024';

const createFixture = async (): Promise<{
  receive: (sscc: string, batchEvidence: MessageInitShape<typeof ReceivingBatchEvidenceSchema>[]) => Promise<void>;
  task: ReturnType<typeof create<typeof ReceivingTaskSchema>>;
}> => {
  const harness = createTestRuntime();
  const { runtime } = harness;
  const userId = await addTestMember(harness, {
    organizationId: TENANT,
    permissions: ['task_edit'],
    warehouseIds: [WAREHOUSE],
  });
  const task = create(ReceivingTaskSchema, {
    dealId: nextUuid(),
    expectedUnits: [
      {
        batches: [
          { batchNumber: 'BATCH-A', dealLineId: 'line', markingCodes: ['demo-a'], quantityBase: 1n },
          { batchNumber: 'BATCH-B', dealLineId: 'line', markingCodes: ['demo-b', 'demo-c'], quantityBase: 2n },
        ],
        id: 'first',
        kind: HandlingUnitKind.PALLET,
        sscc: FIRST_SSCC,
      },
      {
        batches: [{ batchNumber: 'BATCH-C', dealLineId: 'line', markingCodes: ['demo-d'], quantityBase: 1n }],
        id: 'second',
        kind: HandlingUnitKind.PALLET,
        sscc: SECOND_SSCC,
      },
    ],
    id: nextUuid(),
    orderLines: [{
      baseUnit: BaseUnit.PIECE,
      dealLineId: 'line',
      markingMode: MarkingMode.UNIT,
      productId: nextUuid(),
      quantityBase: 4n,
    }],
    receivingAreaId: nextUuid(),
    warehouseId: WAREHOUSE,
  });
  const receive = (sscc: string, batchEvidence: MessageInitShape<typeof ReceivingBatchEvidenceSchema>[]): Promise<void> =>
    runtime.command((transaction) => {
      const request = create(ReceiveHandlingUnitRequestSchema, {
        batchEvidence,
        expectedVersion: 1,
        idempotencyKey: nextUuid(),
        taskId: task.id,
        unit: { case: 'sscc', value: sscc },
        warehouseId: WAREHOUSE,
      });
      const caller = runtime.guard.guardPermissionCall(
        transaction, WarehouseReceivingService.method.receiveHandlingUnit, request, new Headers(callAs(userId, TENANT).headers),
      );
      receiveHandlingUnit(transaction, runtime, caller, task, request);
    });

  return { receive, task };
};

it('preserves per-batch zero fact and records positive physical stock in quarantine', async () => {
  const { receive, task } = await createFixture();
  await receive(FIRST_SSCC, [
    { batchIndex: 0, quantityBase: 0n },
    { batchIndex: 1, defectiveMarkingCodes: ['demo-c'], defectiveQuantityBase: 1n, markingCodes: ['demo-b', 'demo-c'] },
  ]);

  expect(task.receivedUnits).toMatchObject([{
    balanceAtReceipt: { lines: [{ batch: { number: 'BATCH-B' }, quantityBase: 2n, status: StockStatus.QUARANTINE }] },
    batchFacts: [
      { batchIndex: 0, quantityBase: 0n },
      { batchIndex: 1, defectiveQuantityBase: 1n, quantityBase: 2n },
    ],
  }]);
});

it('rejects inconsistent defect evidence and duplicate codes across received places', async () => {
  const { receive, task } = await createFixture();
  const unassignedDefect = await captureError(receive(FIRST_SSCC, [
    { defectiveQuantityBase: 1n, markingCodes: ['demo-a'] },
  ]));
  expect(readErrorDetail(unassignedDefect).code).toBe(ErrorCode.VALIDATION_FAILED);
  await receive(FIRST_SSCC, [{ markingCodes: ['demo-a'] }]);

  const duplicateCode = await captureError(receive(SECOND_SSCC, [{ markingCodes: ['demo-a'] }]));
  expect(readErrorDetail(duplicateCode).code).toBe(ErrorCode.VALIDATION_FAILED);
  expect(task.receivedUnits.map(unit => unit.expectedUnitId)).toEqual(['first']);
});
