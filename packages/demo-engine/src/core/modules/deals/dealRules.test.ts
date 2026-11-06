import { create } from '@bufbuild/protobuf';
import { ErrorCode } from '@skladburg/contracts/common/v1/error';
import { DealLineSchema } from '@skladburg/contracts/deal/v1/deal';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { createDomainErrors } from '../../errors/index';
import { createSeededRandom } from '../../ports/index';
import { captureFailure } from '../catalog/testing/catalogFixtures';
import {
  MAX_DEAL_INTEGER,
  rub,
  sumDealLines,
} from './dealRules';

const errors = createDomainErrors(createSeededRandom(9));

describe('deal aggregate integer bounds', () => {
  it('keeps exact int64 totals beyond Number safe integer', () => {
    const lines = [create(DealLineSchema, { amount: rub(MAX_DEAL_INTEGER - 1n) }), create(DealLineSchema, { amount: rub(1n) })];
    expect(sumDealLines(errors, lines, undefined).amountMinor).toBe(MAX_DEAL_INTEGER);
  });

  it.each(['goods', 'delivery', 'mass', 'volume'])('rejects aggregate %s overflow before serialization', async (kind) => {
    const lines = [create(DealLineSchema, {
      amount: rub(kind === 'goods' || kind === 'delivery' ? MAX_DEAL_INTEGER : 1n),
      productSnapshot: { packagings: [{ baseQuantity: 1n, grossWeightGrams: kind === 'mass' ? MAX_DEAL_INTEGER : 1n,
        volumeCubicCentimeters: kind === 'volume' ? MAX_DEAL_INTEGER : 1n }] },
      quantity: 2n,
    })];
    if (kind === 'goods') {
      lines.push(create(DealLineSchema, { amount: rub(1n) }));
    }
    const failure = await captureFailure(Promise.resolve().then(() => sumDealLines(errors,
      lines,
      kind === 'delivery' ? rub(1n) : undefined)));
    expect(failure.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(failure.violations[0]?.ruleId).toBe('catalog.amount_above_limit');
  });
});
