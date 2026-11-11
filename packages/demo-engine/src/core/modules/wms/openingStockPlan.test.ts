import type {
  PostOpeningStockRequest,
  PostOpeningStockResponse,
} from '@skladburg/contracts/wms/v1/stock';

import { create } from '@bufbuild/protobuf';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { inventoryChannel } from '@skladburg/contracts/runtime';
import {
  HandlingUnitKind,
  PostOpeningStockRequestSchema,
  StockMovementKind,
  StockStatus,
  WarehouseStockService,
} from '@skladburg/contracts/wms/v1/stock';
import {
  describe,
  expect,
  it,
} from 'vitest';

import type { IModuleRuntime } from '../moduleRuntime';
import type { TestRuntimeValue } from '../testing/testRuntime';

import {
  SeedOrganizationId,
  SeedUserId,
  SeedWarehouseId,
} from '../../seed/seedIds';
import { createSeedWarehouseTopologies } from '../../seed/seedWarehouseTopologies';
import {
  callAs,
  captureError,
  readErrorDetail,
} from '../testing/moduleHarness';
import { createTestRuntime } from '../testing/testRuntime';
import {
  applyOpeningStockPlan,
  planOpeningStock,
} from './openingStockPlan';

const TENANT = SeedOrganizationId.SUPPLIER_1;
const WAREHOUSE = SeedWarehouseId.SUPPLIER_1_WAREHOUSE_1;
const CELL = '8f000001-0000-4000-8000-000000000006';
const SSCCS = ['000000000000000017', '000000000000000024', '000000000000000031', '000000000000000048'];
const SUPPLIER_HEADERS = new Headers(callAs(SeedUserId.ADMIN_2, TENANT).headers);

const createStockRuntime = async (): Promise<TestRuntimeValue> => {
  const harness = createTestRuntime();
  await harness.runtime.command((transaction) => {
    for (const topology of createSeedWarehouseTopologies(id => transaction.get('warehouses', id))) {
      transaction.put('warehouseTopologies', topology);
    }
  });

  return harness;
};

const buildRequests = (runtime: IModuleRuntime): PostOpeningStockRequest[] => {
  const [product] = runtime.read.listBy('products', 'tenantId', TENANT);
  if (product === undefined) {
    throw new Error('Expected a supplier product');
  }

  return SSCCS.map((sscc, index) => create(PostOpeningStockRequestSchema, {
    cellId: CELL,
    idempotencyKey: 'f0000000-0000-4000-8000-000000000001',
    kind: HandlingUnitKind.PALLET,
    lines: [{
      batchNumber: index === 0 ? 'Café' : ' Cafe\u0301 ',
      expiresOn: { day: 29, month: 2, year: 2028 },
      productId: product.id,
      quantityBase: 9_007_199_254_740_993n,
      status: StockStatus.AVAILABLE,
    }],
    sourceDocumentNumber: ' IMP-1 ',
    sscc,
    warehouseId: WAREHOUSE,
  }));
};

const applyRequests = (runtime: IModuleRuntime, requests: readonly PostOpeningStockRequest[]): Promise<PostOpeningStockResponse[]> =>
  runtime.command((transaction) => {
    const [request] = requests;
    if (request === undefined) {
      throw new Error('Expected an opening stock request');
    }

    const caller = runtime.guard.guardPermissionCall(transaction, WarehouseStockService.method.postOpeningStock, request, SUPPLIER_HEADERS);
    const plan = planOpeningStock(transaction, runtime.errors, TENANT, WAREHOUSE, requests);

    return applyOpeningStockPlan(transaction, runtime, caller, plan);
  });

describe('opening stock plans', () => {
  it('prepares a batch of handling units without creating records or consuming IDs, then posts one movement per SSCC', async () => {
    const { commits, events, random, runtime } = await createStockRuntime();
    const requests = buildRequests(runtime);
    const randomState = random.getState();
    const commitCount = commits.length;
    const preview = planOpeningStock(runtime.read, runtime.errors, TENANT, WAREHOUSE, requests);

    expect(preview.violations).toEqual([]);
    expect(random.getState()).toEqual(randomState);
    expect(commits).toHaveLength(commitCount);
    expect(events).toEqual([]);
    expect(runtime.read.list('stockBatches')).toEqual([]);
    expect(runtime.read.list('stockBalances')).toEqual([]);
    expect(runtime.read.list('stockMovements')).toEqual([]);

    const responses = await applyRequests(runtime, requests);
    expect(responses.map(response => response.balance?.handlingUnit?.sscc)).toEqual(SSCCS);
    expect(new Set(responses.map(response => response.balance?.lines[0]?.batch?.id)).size).toBe(1);
    expect(responses.map(response => response.movement)).toMatchObject(SSCCS.map(sscc => ({
      actorUserId: SeedUserId.ADMIN_2,
      handlingUnit: { sscc },
      kind: StockMovementKind.OPENING_BALANCE,
      lines: [{
        batch: { number: 'Café' },
        quantityBase: 9_007_199_254_740_993n,
      }],
      sourceDocumentNumber: 'IMP-1',
      toCellId: CELL,
    })));
    expect(runtime.read.list('stockBatches')).toHaveLength(1);
    expect(runtime.read.list('stockBalances')).toHaveLength(SSCCS.length);
    expect(runtime.read.list('stockMovements')).toHaveLength(SSCCS.length);
    expect(commits).toHaveLength(commitCount + 1);
    expect(events).toMatchObject([{
      channel: inventoryChannel(WAREHOUSE),
      payload: { case: 'stockChanged', value: { warehouseId: WAREHOUSE } },
    }]);
  });

  it('reports conflicts in later requests against the planned batch and SSCC and leaves the ledger empty', async () => {
    const { commits, events, runtime } = await createStockRuntime();
    const commitCount = commits.length;
    const [first, second, third] = buildRequests(runtime);
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Expected three opening stock requests');
    }

    const expiresOn = create(CalendarDateSchema, { day: 28, month: 2, year: 2028 });
    const requests = [
      first,
      { ...second, lines: second.lines.map(line => ({ ...line, expiresOn })) },
      { ...third, sscc: first.sscc },
    ];
    const preview = planOpeningStock(runtime.read, runtime.errors, TENANT, WAREHOUSE, requests);

    expect(preview.violations).toEqual([
      { fieldPath: 'lines[0].expires_on', requestIndex: 1, ruleId: 'stock.batch_expiry_mismatch' },
      { fieldPath: 'sscc', requestIndex: 2, ruleId: 'stock.sscc_taken' },
    ]);
    expect(readErrorDetail(await captureError(applyRequests(runtime, requests))).code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(commits).toHaveLength(commitCount);
    expect(events).toEqual([]);
    expect(runtime.read.list('stockBatches')).toEqual([]);
    expect(runtime.read.list('stockBalances')).toEqual([]);
    expect(runtime.read.list('stockMovements')).toEqual([]);
  });
});
