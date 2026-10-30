import type { OrganizationRequisites } from '@skladburg/contracts/organization/v1/requisites';

import { VatMode } from '@skladburg/contracts/organization/v1/requisites';

export interface RequisitesBankFormValues {
  bankName: string;
  bik: string;
  correspondentAccount: string;
  settlementAccount: string;
}

export interface RequisitesFormValues {
  bank: RequisitesBankFormValues;
  legalAddress: string;
  vatMode: string;
}

export interface RequisitesUpdateValue {
  bank: RequisitesBankFormValues;
  legalAddress: string;
  vatMode: VatMode;
}

export const toRequisitesFormValues = (requisites: OrganizationRequisites): RequisitesFormValues => ({
  bank: {
    bankName: requisites.bank?.bankName ?? '',
    bik: requisites.bank?.bik ?? '',
    correspondentAccount: requisites.bank?.correspondentAccount ?? '',
    settlementAccount: requisites.bank?.settlementAccount ?? '',
  },
  legalAddress: requisites.legalAddress,
  vatMode: requisites.vatMode === VatMode.UNSPECIFIED ? '' : String(requisites.vatMode),
});
