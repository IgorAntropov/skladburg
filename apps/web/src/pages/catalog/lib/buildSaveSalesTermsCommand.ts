import type { FormFieldIssueValue } from '@skladburg/contracts/forms';

import type {
  MoneyFormOutputValue,
  SalesTermsFormOutputValue,
} from './salesTermsFormValues';

export interface SaveSalesTermsCommandValue {
  isAutoConfirmEnabled: boolean;
  ownDelivery?: SaveSalesTermsOwnDeliveryValue | undefined;
  preparationWorkingDays: number;
}

export interface SaveSalesTermsMoneyValue {
  amountMinor: bigint;
  currencyCode: string;
}

export interface SaveSalesTermsOwnDeliveryValue {
  minimumCharge: SaveSalesTermsMoneyValue;
  pricePerKm: SaveSalesTermsMoneyValue;
}

const REQUIRED_RULE_ID = 'required';

const PREPARATION_DAYS_PATH = 'preparationWorkingDays';

const PRICE_PER_KM_PATH = 'ownDelivery.pricePerKm.amountMinor';

const MINIMUM_CHARGE_PATH = 'ownDelivery.minimumCharge.amountMinor';

const toMoney = (money: MoneyFormOutputValue): SaveSalesTermsMoneyValue | undefined => (
  money.amountMinor === undefined ? undefined : { amountMinor: money.amountMinor, currencyCode: money.currencyCode }
);

export const collectSalesTermsIssues = (values: SalesTermsFormOutputValue): readonly FormFieldIssueValue[] => {
  const issues: FormFieldIssueValue[] = [];

  if (values.preparationWorkingDays === undefined) {
    issues.push({ field: PREPARATION_DAYS_PATH, ruleId: REQUIRED_RULE_ID });
  }

  if (values.hasOwnDelivery) {
    if (values.ownDelivery.pricePerKm.amountMinor === undefined) {
      issues.push({ field: PRICE_PER_KM_PATH, ruleId: REQUIRED_RULE_ID });
    }

    if (values.ownDelivery.minimumCharge.amountMinor === undefined) {
      issues.push({ field: MINIMUM_CHARGE_PATH, ruleId: REQUIRED_RULE_ID });
    }
  }

  return issues;
};

export const buildSaveSalesTermsCommand = (values: SalesTermsFormOutputValue): SaveSalesTermsCommandValue => {
  const pricePerKm = toMoney(values.ownDelivery.pricePerKm);
  const minimumCharge = toMoney(values.ownDelivery.minimumCharge);
  const isOwnDeliverySent = values.hasOwnDelivery && pricePerKm !== undefined && minimumCharge !== undefined;

  return {
    isAutoConfirmEnabled: values.isAutoConfirmEnabled,
    ownDelivery: isOwnDeliverySent ? { minimumCharge, pricePerKm } : undefined,
    preparationWorkingDays: values.preparationWorkingDays ?? 0,
  };
};
