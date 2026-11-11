import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import { inventoryChannel } from '@skladburg/contracts/runtime';
import {
  HandlingUnitKind,
  ListStockBalancesRequestSchema,
  ListStockBalancesResponseSchema,
  ListStockMovementsRequestSchema,
  ListStockMovementsResponseSchema,
  MoveHandlingUnitRequestSchema,
  MoveHandlingUnitResponseSchema,
  PostOpeningStockRequestSchema,
  PostOpeningStockResponseSchema,
  StockMovementKind,
  StockStatus,
} from '@skladburg/contracts/wms/v1/stock';
import { randomUUID } from 'node:crypto';

import {
  expect,
  test,
} from './fixtures/test.ts';
import { createEngineWorkerRobot } from './robots/engine-worker-robot.ts';

const WAREHOUSE_ID = '80000004-0000-4000-8000-000000000000';
const PRODUCT_ID = 'd0010001-0000-4000-8000-000000000000';
const FROM_CELL_ID = '8f000001-0000-4000-8000-000000000006';
const TO_CELL_ID = '8f000001-0000-4000-8000-000000000007';
const QUANTITY = 9_007_199_254_740_993n;
const STOCK_SERVICE = 'wms.v1.WarehouseStockService';

test('posts and moves stock in the Worker and retains its journal after reopening', async ({ page }) => {
  const worker = await createEngineWorkerRobot(page);
  const opening = toBinary(PostOpeningStockRequestSchema, create(PostOpeningStockRequestSchema, {
    cellId: FROM_CELL_ID,
    idempotencyKey: randomUUID(),
    kind: HandlingUnitKind.PALLET,
    lines: [{ batchNumber: 'LOT-1', productId: PRODUCT_ID, quantityBase: QUANTITY, status: StockStatus.AVAILABLE }],
    sourceDocumentNumber: 'WMS-1',
    sscc: '000000000000000017',
    warehouseId: WAREHOUSE_ID,
  }));
  let handlingUnitId: string;

  try {
    await expect.poll(worker.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect(worker.hasRequestedChunk('warehouseStockService')).toBe(false);
    const subscription = await worker.subscribe(inventoryChannel(WAREHOUSE_ID));
    expect(subscription.kind).toBe('subscribed');

    const posted = fromBinary(PostOpeningStockResponseSchema, await worker.call(`${STOCK_SERVICE}/PostOpeningStock`, opening));
    expect(worker.hasRequestedChunk('warehouseStockService')).toBe(true);
    const handlingUnit = posted.balance?.handlingUnit;
    if (handlingUnit === undefined) {
      throw new Error('Expected the handling unit to be posted');
    }
    handlingUnitId = handlingUnit.id;
    const transfer = toBinary(MoveHandlingUnitRequestSchema, create(MoveHandlingUnitRequestSchema, {
      expectedVersion: handlingUnit.version,
      handlingUnitId,
      idempotencyKey: randomUUID(),
      sourceDocumentNumber: 'WMS-2',
      toCellId: TO_CELL_ID,
      warehouseId: WAREHOUSE_ID,
    }));
    const moved = fromBinary(MoveHandlingUnitResponseSchema, await worker.call(`${STOCK_SERVICE}/MoveHandlingUnit`, transfer));
    expect(moved.movement).toMatchObject({ fromCellId: FROM_CELL_ID, toCellId: TO_CELL_ID });
    await expect.poll(async () => (await worker.readEvents(subscription.id)).map(event => event.payload.case))
      .toEqual(['stockChanged', 'stockChanged']);
  }
  finally {
    await worker.stop();
  }

  const reopened = await createEngineWorkerRobot(page);
  try {
    await expect.poll(reopened.readStartup).toMatchObject({ kind: 'ready', storage: 'indexed-db' });
    expect(reopened.hasRequestedChunk('seedSnapshot')).toBe(false);
    expect(reopened.hasRequestedChunk('warehouseStockService')).toBe(false);
    const request = { warehouseId: WAREHOUSE_ID };
    const { balances } = fromBinary(ListStockBalancesResponseSchema, await reopened.call(`${STOCK_SERVICE}/ListStockBalances`,
      toBinary(ListStockBalancesRequestSchema, create(ListStockBalancesRequestSchema, request))));
    expect(balances).toEqual([expect.objectContaining({
      cellId: TO_CELL_ID,
      handlingUnit: expect.objectContaining({ id: handlingUnitId, version: 2 }),
      lines: [expect.objectContaining({ quantityBase: QUANTITY })],
    })]);

    const { movements } = fromBinary(ListStockMovementsResponseSchema, await reopened.call(`${STOCK_SERVICE}/ListStockMovements`,
      toBinary(ListStockMovementsRequestSchema, create(ListStockMovementsRequestSchema, request))));
    expect(movements).toHaveLength(2);
    expect(movements).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: StockMovementKind.OPENING_BALANCE, toCellId: FROM_CELL_ID }),
      expect.objectContaining({ fromCellId: FROM_CELL_ID, kind: StockMovementKind.TRANSFER, toCellId: TO_CELL_ID }),
    ]));
  }
  finally {
    await reopened.stop();
  }
});
