import type {
  OrganizationRequisites,
  Signatory,
} from '@skladburg/contracts/organization/v1/requisites';

export interface ApplySavedRequisitesOptionsValue {
  isFormDirty: boolean;
  isSignatoryEditing: boolean;
  source: RequisitesSavedSourceValue;
}

export interface RequisitesEditorStateValue {
  epoch: number;
  formVersion: bigint;
  requisites: OrganizationRequisites;
  signatoriesVersion: bigint;
}

export type RequisitesSavedSourceValue = 'form' | 'reload' | 'signatories';

const areBanksEqual = (current: OrganizationRequisites['bank'], saved: OrganizationRequisites['bank']): boolean => {
  if (current === undefined || saved === undefined) {
    return current === saved;
  }

  return current.bankName === saved.bankName
    && current.bik === saved.bik
    && current.correspondentAccount === saved.correspondentAccount
    && current.settlementAccount === saved.settlementAccount;
};

const areDatesEqual = (current: Signatory['powerOfAttorneyDate'], saved: Signatory['powerOfAttorneyDate']): boolean => {
  if (current === undefined || saved === undefined) {
    return current === saved;
  }

  return current.day === saved.day && current.month === saved.month && current.year === saved.year;
};

const areSignatoriesEqual = (current: Signatory, saved: Signatory): boolean =>
  current.id === saved.id
  && current.fullName === saved.fullName
  && current.position === saved.position
  && current.basis === saved.basis
  && current.powerOfAttorneyNumber === saved.powerOfAttorneyNumber
  && current.isDefault === saved.isDefault
  && areDatesEqual(current.powerOfAttorneyDate, saved.powerOfAttorneyDate);

const isFormDataEqual = (current: OrganizationRequisites, saved: OrganizationRequisites): boolean =>
  current.legalAddress === saved.legalAddress
  && current.vatMode === saved.vatMode
  && areBanksEqual(current.bank, saved.bank);

const areSignatoryListsEqual = (current: readonly Signatory[], saved: readonly Signatory[]): boolean =>
  current.length === saved.length
  && current.every((signatory, index) => {
    const savedSignatory = saved[index];

    return savedSignatory !== undefined && areSignatoriesEqual(signatory, savedSignatory);
  });

export const applySavedRequisites = (
  state: RequisitesEditorStateValue,
  saved: OrganizationRequisites,
  options: ApplySavedRequisitesOptionsValue,
): RequisitesEditorStateValue => {
  const hasExternalFormChange = options.source === 'signatories' && !isFormDataEqual(state.requisites, saved);
  const isFormVersionAdvanced = !hasExternalFormChange || !options.isFormDirty;
  const isSignatoriesVersionAdvanced = options.source !== 'form' || !options.isSignatoryEditing
    || areSignatoryListsEqual(state.requisites.signatories, saved.signatories);
  const isFormRecreated = options.source === 'reload' || (hasExternalFormChange && !options.isFormDirty);

  return {
    epoch: isFormRecreated ? state.epoch + 1 : state.epoch,
    formVersion: isFormVersionAdvanced ? saved.version : state.formVersion,
    requisites: saved,
    signatoriesVersion: isSignatoriesVersionAdvanced ? saved.version : state.signatoriesVersion,
  };
};
