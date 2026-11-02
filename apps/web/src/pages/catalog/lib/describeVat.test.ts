import { VatRate } from '@skladburg/contracts/catalog/v1/catalog';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { describeVat } from './describeVat';

describe('describeVat', () => {
  it('names the rates of the contract', () => {
    expect(describeVat(VatRate.VAT_RATE_10)).toEqual({ kind: 'rate', percent: 10 });
    expect(describeVat(VatRate.VAT_RATE_22)).toEqual({ kind: 'rate', percent: 22 });
  });

  it('tells a product without VAT from a product with an unknown rate', () => {
    expect(describeVat(VatRate.VAT_RATE_NONE)).toEqual({ kind: 'none' });
    expect(describeVat(VatRate.VAT_RATE_UNSPECIFIED)).toBeUndefined();
  });
});
