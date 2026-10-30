import { VatMode } from '@skladburg/contracts/organization/v1/requisites';

import type { RequisitesMessageKeyValue } from '../i18n/requisitesSection';

export interface VatModeOptionValue {
  labelKey: VatModeLabelKeyValue;
  value: VatMode;
}

type VatModeLabelKeyValue = Extract<RequisitesMessageKeyValue, `requisites.vatMode.${string}`>;

export const VAT_MODE_OPTIONS: readonly VatModeOptionValue[] = [
  { labelKey: 'requisites.vatMode.general', value: VatMode.GENERAL },
  { labelKey: 'requisites.vatMode.simplifiedWithVat', value: VatMode.SIMPLIFIED_WITH_VAT },
  { labelKey: 'requisites.vatMode.withoutVat', value: VatMode.WITHOUT_VAT },
];
