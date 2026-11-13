import {
  create,
  toBinary,
} from '@bufbuild/protobuf';
import {
  BaseUnit,
  MarkingMode,
} from '@skladburg/contracts/catalog/v1/catalog';
import { DealSchema } from '@skladburg/contracts/deal/v1/deal';
import {
  PutAwayHandlingUnitRequestSchema,
  ReceivingTaskSchema,
  ReceivingTaskStatus,
  WarehouseReceivingService,
} from '@skladburg/contracts/wms/v1/receiving';
import {
  MoveHandlingUnitRequestSchema,
  StockBalanceSchema,
  StockMovementKind,
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
import { createSeedWarehouseTopologies } from '../../seed/seedWarehouseTopologies';
import { nextUuid } from '../catalog/testing/catalogFixtures';
import {
  MAX_DEAL_INTEGER,
  rub,
} from '../deals/dealRules';
import {
  addTestMember,
  callAs,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import { moveHandlingUnit } from './moveHandlingUnit';
import { putAwayHandlingUnit } from './putAwayHandlingUnit';
import {
  classifyWarehouseReceipt,
  reconcileWarehouseReceipt,
} from './receiptReconciliation';
import {
  buildSsccKey,
  readStockBalance,
  readStockMovement,
} from './stockRecords';

const createReceiptDeal = (quantity: bigint): ReturnType<typeof create<typeof DealSchema>> => create(DealSchema, {
  id: 'deal',
  lines: [{
    amount: rub(quantity * 102n),
    id: 'line',
    price: rub(204n),
    priceUnitCoefficient: 2n,
    quantity,
  }],
  shipToWarehouseId: 'warehouse',
});

it('matches the documented quantity by batch and holds defective, excess, and undocumented quantities', () => {
  const { runtime } = createTestRuntime();
  const deal = createReceiptDeal(8n);
  const task = create(ReceivingTaskSchema, {
    dealId: deal.id,
    expectedUnits: [
      { batches: [{ dealLineId: 'line', quantityBase: 6n }], id: 'first' },
      { batches: [{ dealLineId: 'line', quantityBase: 2n }], id: 'second' },
    ],
    orderLines: [{ baseUnit: BaseUnit.PIECE, dealLineId: 'line', quantityBase: 8n }],
    receivedUnits: [
      {
        balanceAtReceipt: {
          handlingUnit: { id: 'first-balance' },
          lines: [{ quantityBase: 7n, status: StockStatus.QUARANTINE }],
        },
        batchFacts: [{ defectiveQuantityBase: 2n, quantityBase: 7n }],
        expectedUnitId: 'first',
      },
    ],
    warehouseId: deal.shipToWarehouseId,
  });

  expect(reconcileWarehouseReceipt(runtime, task, deal)).toMatchObject({
    acceptedGoodsMinor: 510n,
    hasDiscrepancies: true,
    lines: [{
      acceptedGoodsAmount: rub(510n),
      acceptedQuantityBase: 5n,
      defectiveQuantityBase: 2n,
      documentedQuantityBase: 8n,
      excessQuantityBase: 1n,
      orderedQuantityBase: 8n,
      receivedQuantityBase: 7n,
      shortageQuantityBase: 2n,
    }],
  });
});

it('does not release unexpected, missing or defective unit marking', () => {
  const { runtime } = createTestRuntime();
  const deal = createReceiptDeal(5n);
  const task = create(ReceivingTaskSchema, {
    dealId: deal.id,
    expectedUnits: [{
      batches: [{ dealLineId: 'line', markingCodes: ['a', 'b', 'c', 'd', 'e'], quantityBase: 5n }],
      id: 'place',
    }],
    orderLines: [{ baseUnit: BaseUnit.PIECE, dealLineId: 'line', markingMode: MarkingMode.UNIT, quantityBase: 5n }],
    receivedUnits: [{
      balanceAtReceipt: { handlingUnit: { id: 'balance' }, lines: [{ quantityBase: 5n, status: StockStatus.QUARANTINE }] },
      batchFacts: [{
        defectiveMarkingCodes: ['b'],
        defectiveQuantityBase: 1n,
        markingCodes: ['a', 'b', 'c', 'x'],
        quantityBase: 5n,
      }],
      expectedUnitId: 'place',
    }],
    warehouseId: deal.shipToWarehouseId,
  });

  expect(reconcileWarehouseReceipt(runtime, task, deal)).toMatchObject({
    acceptedGoodsMinor: 204n,
    hasDiscrepancies: true,
    lines: [{
      acceptedQuantityBase: 2n,
      defectiveQuantityBase: 1n,
      missingMarkingCount: 2n,
      receivedQuantityBase: 5n,
      unexpectedMarkingCount: 1n,
    }],
  });
});

it('accepts the legacy fact in the original batch order', () => {
  const { runtime } = createTestRuntime();
  const deal = createReceiptDeal(3n);
  const task = create(ReceivingTaskSchema, {
    dealId: deal.id,
    expectedUnits: [{ batches: [{ dealLineId: 'line', quantityBase: 3n }], id: 'place' }],
    orderLines: [{ baseUnit: BaseUnit.PIECE, dealLineId: 'line', quantityBase: 3n }],
    receivedUnits: [{
      balanceAtReceipt: { handlingUnit: { id: 'balance' }, lines: [{ quantityBase: 3n, status: StockStatus.QUARANTINE }] },
      expectedUnitId: 'place',
    }],
    warehouseId: deal.shipToWarehouseId,
  });

  expect(reconcileWarehouseReceipt(runtime, task, deal)).toMatchObject({
    acceptedGoodsMinor: 306n,
    hasDiscrepancies: false,
    lines: [{ acceptedQuantityBase: 3n, receivedQuantityBase: 3n }],
  });
});

it('caps public counts for a saved oversized 5.5 fact and calculates only the documented order value', () => {
  const { runtime } = createTestRuntime();
  const deal = createReceiptDeal(2n);
  const task = create(ReceivingTaskSchema, {
    dealId: deal.id,
    expectedUnits: [
      { batches: [{ dealLineId: 'line', quantityBase: 1n }], id: 'first' },
      { batches: [{ dealLineId: 'line', quantityBase: 1n }], id: 'second' },
    ],
    orderLines: [{ baseUnit: BaseUnit.PIECE, dealLineId: 'line', quantityBase: 2n }],
    receivedUnits: ['first', 'second'].map(expectedUnitId => ({
      balanceAtReceipt: { lines: [{ quantityBase: MAX_DEAL_INTEGER, status: StockStatus.QUARANTINE }] },
      expectedUnitId,
    })),
    warehouseId: deal.shipToWarehouseId,
  });

  expect(reconcileWarehouseReceipt(runtime, task, deal)).toMatchObject({
    acceptedGoodsMinor: 204n,
    hasDiscrepancies: true,
    lines: [{
      acceptedQuantityBase: 2n,
      excessQuantityBase: MAX_DEAL_INTEGER,
      receivedQuantityBase: MAX_DEAL_INTEGER,
    }],
  });
  expect(task.receivedUnits.map(unit => unit.balanceAtReceipt?.lines[0]?.quantityBase)).toEqual([MAX_DEAL_INTEGER, MAX_DEAL_INTEGER]);
});

it.each([true, false])('records classification and placement atomically with placement first=%s', async (isPlacementFirst) => {
  const harness = createTestRuntime();
  const { runtime } = harness;
  const warehouseId = SeedWarehouseId.CUSTOMER_1_WAREHOUSE_1;
  const organizationId = SeedOrganizationId.CUSTOMER_1;
  const toCellId = '8f000002-0000-4000-8000-000000000006';
  const receivingAreaId = '8f000002-0000-4000-8000-000000000010';
  const relocatedCellId = '8f000002-0000-4000-8000-000000000007';
  const sscc = '000000000000000017';
  const handlingUnitId = nextUuid();
  const assigneeUserId = await addTestMember(harness, {
    organizationId,
    permissions: ['task_edit'],
    warehouseIds: [warehouseId],
  });
  const deal = createReceiptDeal(3n);
  deal.shipToWarehouseId = warehouseId;
  const original = create(StockBalanceSchema, {
    handlingUnit: { id: handlingUnitId, sscc, tenantId: organizationId, version: 1, warehouseId },
    lines: [{ quantityBase: 4n, status: StockStatus.QUARANTINE }],
    receivingAreaId,
  });
  const task = create(ReceivingTaskSchema, {
    assigneeUserId,
    dealId: deal.id,
    expectedUnits: [{ batches: [{ dealLineId: 'line', quantityBase: 3n }], id: 'place' }],
    id: nextUuid(),
    orderLines: [{ baseUnit: BaseUnit.PIECE, dealLineId: 'line', quantityBase: 3n }],
    receivedUnits: [{
      balanceAtReceipt: original,
      batchFacts: [{ defectiveQuantityBase: 2n, quantityBase: 4n }],
      expectedUnitId: 'place',
    }],
    receivingAreaId,
    warehouseId,
  });
  await runtime.command((transaction) => {
    for (const topology of createSeedWarehouseTopologies(id => transaction.get('warehouses', id))) {
      transaction.put('warehouseTopologies', topology);
    }
    transaction.put('stockBalances', {
      bytes: toBinary(StockBalanceSchema, original),
      id: handlingUnitId,
      lookupKey: buildSsccKey(organizationId, sscc),
      scopeId: warehouseId,
    });
  });
  await runtime.command((transaction) => {
    const request = create(PutAwayHandlingUnitRequestSchema, {
      expectedVersion: 1,
      handlingUnitId,
      idempotencyKey: nextUuid(),
      taskId: task.id,
      toCellId,
      warehouseId,
    });
    const caller = runtime.guard.guardPermissionCall(
      transaction,
      WarehouseReceivingService.method.putAwayHandlingUnit,
      request,
      new Headers(callAs(assigneeUserId, organizationId).headers),
    );
    if (isPlacementFirst) {
      putAwayHandlingUnit(transaction, runtime, caller, task, request);
      moveHandlingUnit(transaction, runtime, caller, create(MoveHandlingUnitRequestSchema, {
        expectedVersion: 2,
        handlingUnitId: request.handlingUnitId,
        idempotencyKey: request.idempotencyKey,
        sourceDocumentNumber: 'TRANSFER-1',
        toCellId: relocatedCellId,
        warehouseId,
      }));
    }
    classifyWarehouseReceipt(runtime, transaction, caller, task, reconcileWarehouseReceipt(runtime, task, deal), 'ACT-1');
    task.status = ReceivingTaskStatus.RECONCILED;
    if (!isPlacementFirst) {
      putAwayHandlingUnit(transaction, runtime, caller, task, request);
    }
  });

  const record = runtime.read.get('stockBalances', handlingUnitId);
  if (record === undefined) {
    throw new Error('Missing classified balance');
  }
  const balance = readStockBalance(record, organizationId, runtime.errors);
  expect(balance).toMatchObject({
    cellId: isPlacementFirst ? relocatedCellId : toCellId,
    handlingUnit: { version: isPlacementFirst ? 4 : 3 },
    lines: [
      { quantityBase: 2n, status: StockStatus.AVAILABLE },
      { quantityBase: 2n, status: StockStatus.DEFECTIVE },
    ],
  });
  const movements = runtime.read.listBy('stockMovements', 'scopeId', warehouseId)
    .map(movement => readStockMovement(movement, organizationId, runtime.errors));
  const classification = movements.find(movement => movement.kind === StockMovementKind.RECEIPT_CLASSIFICATION);
  expect(classification).toMatchObject({ dealId: deal.id, sourceDocumentNumber: 'ACT-1' });
  expect(classification?.fromCellId).toBe(isPlacementFirst ? relocatedCellId : undefined);
  expect(classification?.fromReceivingAreaId).toBe(isPlacementFirst ? undefined : receivingAreaId);
  expect(task.receivedUnits[0]?.balanceAtReceipt).toMatchObject({
    handlingUnit: { version: 1 },
    lines: [{ quantityBase: 4n, status: StockStatus.QUARANTINE }],
    receivingAreaId,
  });
});
