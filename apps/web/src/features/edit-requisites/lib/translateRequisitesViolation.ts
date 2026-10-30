import type {
  RequisitesMessageKeyValue,
  RequisitesTranslate,
} from '../i18n/requisitesSection';

type ViolationKeyValue = Extract<RequisitesMessageKeyValue, `requisites.validation.${string}`>;

const VIOLATION_KEYS: ReadonlyMap<string, ViolationKeyValue> = new Map<string, ViolationKeyValue>([
  ['calendar_date.exists', 'requisites.validation.calendar_date.exists'],
  ['field_check.bik', 'requisites.validation.field_check.bik'],
  ['field_check.correspondent_account', 'requisites.validation.field_check.correspondent_account'],
  ['field_check.settlement_account', 'requisites.validation.field_check.settlement_account'],
  ['int32.gte_lte', 'requisites.validation.int32.gte_lte'],
  [
    'signatory.power_of_attorney_date_not_future',
    'requisites.validation.signatory.power_of_attorney_date_not_future',
  ],
  [
    'signatory.power_of_attorney_date_required',
    'requisites.validation.signatory.power_of_attorney_date_required',
  ],
  [
    'signatory.power_of_attorney_number_required',
    'requisites.validation.signatory.power_of_attorney_number_required',
  ],
]);

export const translateRequisitesViolation = (t: RequisitesTranslate, ruleId: string): string | undefined => {
  const key = VIOLATION_KEYS.get(ruleId);

  return key === undefined ? undefined : t(key);
};
