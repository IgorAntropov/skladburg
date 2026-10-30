import type {
  FormFieldBindingValue,
  FormFieldOptionsValue,
} from '@/shared/lib/form';

export type RequisitesFieldBinder = (
  name: RequisitesFieldNameValue,
  options?: FormFieldOptionsValue,
) => FormFieldBindingValue;

export type RequisitesFieldNameValue
  = | 'bank.bankName'
    | 'bank.bik'
    | 'bank.correspondentAccount'
    | 'bank.settlementAccount'
    | 'legalAddress'
    | 'vatMode';

