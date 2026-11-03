import type { SalesTerms } from '@skladburg/contracts/catalog/v1/catalog';

import { RUB_CURRENCY_CODE } from '@/shared/lib/money';

export interface MoneyFormOutputValue {
  amountMinor?: bigint | undefined;
  currencyCode: string;
}

export interface MoneyFormValue {
  amountMinor: string;
  currencyCode: string;
}

export interface SalesTermsFormOutputValue {
  hasOwnDelivery: boolean;
  isAutoConfirmEnabled: boolean;
  ownDelivery: {
    minimumCharge: MoneyFormOutputValue;
    pricePerKm: MoneyFormOutputValue;
  };
  preparationWorkingDays?: number | undefined;
}

export interface SalesTermsFormValues {
  hasOwnDelivery: boolean;
  isAutoConfirmEnabled: boolean;
  ownDelivery: {
    minimumCharge: MoneyFormValue;
    pricePerKm: MoneyFormValue;
  };
  preparationWorkingDays: string;
}

const toMoneyFormValue = (amountMinor: bigint | undefined): MoneyFormValue => ({
  amountMinor: amountMinor === undefined ? '' : amountMinor.toString(),
  currencyCode: RUB_CURRENCY_CODE,
});

export const toSalesTermsFormValues = (terms: SalesTerms): SalesTermsFormValues => ({
  hasOwnDelivery: terms.ownDelivery !== undefined,
  isAutoConfirmEnabled: terms.isAutoConfirmEnabled,
  ownDelivery: {
    minimumCharge: toMoneyFormValue(terms.ownDelivery?.minimumCharge?.amountMinor),
    pricePerKm: toMoneyFormValue(terms.ownDelivery?.pricePerKm?.amountMinor),
  },
  preparationWorkingDays: String(terms.preparationWorkingDays),
});
