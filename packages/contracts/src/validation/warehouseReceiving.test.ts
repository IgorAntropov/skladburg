import {
  create,
  fromBinary,
  toBinary,
} from '@bufbuild/protobuf';
import {
  expect,
  it,
} from 'vitest';

import { ReceiveHandlingUnitRequestSchema } from '../gen/wms/v1/receiving_pb';
import { collectViolations } from './collectViolations';

const warehouseId = '64f40000-0000-4000-8000-000000000001';
const taskId = '64f40000-0000-4000-8000-000000000002';
const idempotencyKey = '64f40000-0000-4000-8000-000000000003';
const expectedUnitId = '64f40000-0000-4000-8000-000000000004';

it('requires a receiving unit, an expected version and an idempotency key', () => {
  const input = create(ReceiveHandlingUnitRequestSchema, { taskId, warehouseId });

  expect(collectViolations(ReceiveHandlingUnitRequestSchema, input)).toEqual(expect.arrayContaining([
    { fieldPath: 'expected_version', ruleId: 'int32.gt' },
    { fieldPath: 'idempotency_key', ruleId: 'string.uuid_empty' },
    { fieldPath: 'unit', ruleId: 'required' },
  ]));
});

it('accepts a receiving command for a labelled unit', () => {
  const input = create(ReceiveHandlingUnitRequestSchema, {
    expectedVersion: 3,
    idempotencyKey,
    taskId,
    unit: { case: 'sscc', value: '000000000000000017' },
    warehouseId,
  });

  expect(collectViolations(ReceiveHandlingUnitRequestSchema, input)).toEqual([]);
});

it('round-trips a receiving command for an unlabelled unit with an exact int64 quantity', () => {
  const input = create(ReceiveHandlingUnitRequestSchema, {
    expectedVersion: 4,
    idempotencyKey,
    taskId,
    unit: { case: 'unlabelledUnit', value: { expectedUnitId, gtin: '20000011', quantityBase: 9_007_199_254_740_993n } },
    warehouseId,
  });
  const restored = fromBinary(ReceiveHandlingUnitRequestSchema, toBinary(ReceiveHandlingUnitRequestSchema, input));

  expect(collectViolations(ReceiveHandlingUnitRequestSchema, restored)).toEqual([]);
  expect(restored).toMatchObject({
    expectedVersion: 4,
    idempotencyKey,
    taskId,
    unit: { case: 'unlabelledUnit', value: { expectedUnitId, gtin: '20000011', quantityBase: 9_007_199_254_740_993n } },
    warehouseId,
  });
});
