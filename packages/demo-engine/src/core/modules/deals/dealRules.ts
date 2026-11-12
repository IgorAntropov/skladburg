import type { Money } from '@skladburg/contracts/common/v1/money';
import type { DealLine } from '@skladburg/contracts/deal/v1/deal';
import type { DealRuleId } from '@skladburg/contracts/runtime';

import { create } from '@bufbuild/protobuf';
import { MoneySchema } from '@skladburg/contracts/common/v1/money';

import type { IDomainErrors } from '../../errors/index';

export const MAX_DEAL_INTEGER = 9_223_372_036_854_775_807n;

export const rub = (amountMinor: bigint): Money => create(MoneySchema, { amountMinor, currencyCode: 'RUB' });

export const failDealValidation = (
  errors: IDomainErrors,
  fieldPath: string,
  ruleId: 'catalog.amount_above_limit' | 'int64.gt' | 'money.currency_unsupported' | DealRuleId,
): never => {
  throw errors.validationFailed([{ fieldPath, ruleId }]);
};

export const checkDealInteger = (errors: IDomainErrors, amount: bigint, fieldPath: string): bigint => {
  if (amount < 0n || amount > MAX_DEAL_INTEGER) {
    failDealValidation(errors, fieldPath, 'catalog.amount_above_limit');
  }
  return amount;
};

export const sumDealLines = (errors: IDomainErrors, lines: readonly DealLine[], deliveryTotal: Money | undefined): Money => {
  let amountMinor = 0n;
  let totalWeight = 0n;
  let totalVolume = 0n;
  for (const line of lines) {
    amountMinor += line.amount?.amountMinor ?? 0n;
    const packaging = line.productSnapshot?.packagings[0];
    if (packaging !== undefined && packaging.baseQuantity > 0n) {
      totalWeight += (line.quantity * packaging.grossWeightGrams + packaging.baseQuantity - 1n) / packaging.baseQuantity;
      totalVolume += (line.quantity * packaging.volumeCubicCentimeters + packaging.baseQuantity - 1n) / packaging.baseQuantity;
    }
  }
  checkDealInteger(errors, totalWeight, 'lines');
  checkDealInteger(errors, totalVolume, 'lines');
  checkDealInteger(errors, amountMinor + (deliveryTotal?.amountMinor ?? 0n), 'goods_total.amount_minor');
  return rub(amountMinor);
};
