import { SignatoryBasis } from '@skladburg/contracts/organization/v1/requisites';

import type { RequisitesMessageKeyValue } from '../i18n/requisitesSection';

export interface SignatoryBasisOptionValue {
  labelKey: SignatoryBasisLabelKeyValue;
  value: SignatoryBasis;
}

type SignatoryBasisLabelKeyValue = Extract<RequisitesMessageKeyValue, `requisites.signatories.basis.${string}`>;

export const SIGNATORY_BASIS_OPTIONS: readonly SignatoryBasisOptionValue[] = [
  { labelKey: 'requisites.signatories.basis.charter', value: SignatoryBasis.CHARTER },
  { labelKey: 'requisites.signatories.basis.powerOfAttorney', value: SignatoryBasis.POWER_OF_ATTORNEY },
];
