import { validateFormValues } from '@skladburg/contracts/forms';
import {
  CounterDealLineFormRules,
  CounterDealRequestFormRules,
} from '@skladburg/contracts/forms/deal/v1/deal';
import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  createDealLineRules,
  validateDealDate,
} from './dealFormValidation';

describe('validateDealDate', () => {
  it('maps a contract date bound to the visible calendar field', () => {
    expect(validateDealDate(CounterDealRequestFormRules, '2101-01-01')).toContainEqual({
      field: 'desiredDate',
      ruleId: 'int32.gte_lte',
    });
  });

  it('rejects nonexistent dates within the contract bounds', () => {
    expect(validateDealDate(CounterDealRequestFormRules, '2027-02-29')).toContainEqual({
      field: 'desiredDate',
      ruleId: 'deal.date.invalid',
    });
  });

  it('allows a leap day', () => {
    expect(validateDealDate(CounterDealRequestFormRules, '2028-02-29')).toEqual([]);
  });
});

describe('createDealLineRules', () => {
  const pricePath = 'lines.0.price.amountMinor';
  const rules = createDealLineRules(CounterDealRequestFormRules, CounterDealLineFormRules, 1, ['price.amountMinor']);

  it('allows a zero price when the contract allows it', () => {
    expect(validateFormValues(rules, { 'lines.0.price': { amountMinor: 0n }, [pricePath]: 0n }, [pricePath])).toEqual([]);
  });

  it('requires an entered price for each existing line', () => {
    expect(validateFormValues(rules, { 'lines.0.price': {}, [pricePath]: undefined }, [pricePath])).toEqual([
      { field: pricePath, ruleId: 'required' },
    ]);
  });
});
