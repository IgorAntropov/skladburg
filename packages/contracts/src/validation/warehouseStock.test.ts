import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  expect,
  it,
} from 'vitest';

import {
  HandlingUnitKind,
  MoveHandlingUnitRequestSchema,
  type PostOpeningStockRequest,
  PostOpeningStockRequestSchema,
  StockStatus,
} from '../gen/wms/v1/stock_pb';
import { collectViolations } from './collectViolations';

const uuid = '3f2b8c1e-5a47-4d9b-8e21-7c6a90b4d153';
const quantityBase = 9_007_199_254_740_993n;

const buildOpening = (quantity: bigint, status: StockStatus, sscc: string): PostOpeningStockRequest =>
  create(PostOpeningStockRequestSchema, {
    cellId: uuid,
    idempotencyKey: uuid,
    kind: HandlingUnitKind.PALLET,
    lines: [{ batchNumber: 'LOT-1', productId: uuid, quantityBase: quantity, status }],
    sourceDocumentNumber: 'WMS-1',
    sscc,
    warehouseId: uuid,
  });

it('round-trips a valid opening quantity larger than the JavaScript safe integer range', () => {
  const input = buildOpening(quantityBase, StockStatus.AVAILABLE, '000000000000000017');
  expect(collectViolations(PostOpeningStockRequestSchema, input)).toEqual([]);
  const restored = fromBinary(PostOpeningStockRequestSchema, toBinary(PostOpeningStockRequestSchema, input));
  expect(restored.lines[0]?.quantityBase).toBe(quantityBase);
});

it('rejects an opening reserve, a negative quantity, and a malformed SSCC', () => {
  const input = buildOpening(-1n, StockStatus.RESERVED, '000000000000000O17');
  expect(collectViolations(PostOpeningStockRequestSchema, input)).toEqual(expect.arrayContaining([
    { fieldPath: 'lines[0].status', ruleId: 'enum.in' },
    { fieldPath: 'lines[0].quantity_base', ruleId: 'int64.gt' },
    { fieldPath: 'sscc', ruleId: 'string.pattern' },
  ]));
});

it('requires a version when moving a handling unit', () => {
  const input = create(MoveHandlingUnitRequestSchema, {
    handlingUnitId: uuid,
    idempotencyKey: uuid,
    sourceDocumentNumber: 'WMS-2',
    toCellId: uuid,
    warehouseId: uuid,
  });
  expect(collectViolations(MoveHandlingUnitRequestSchema, input)).toEqual([
    { fieldPath: 'expected_version', ruleId: 'int32.gt' },
  ]);
});
