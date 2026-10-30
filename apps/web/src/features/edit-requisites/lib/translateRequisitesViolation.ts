import type {
  RequisitesMessageKeyValue,
  RequisitesTranslate,
} from '../i18n/requisitesSection';

type ViolationKeyValue = Extract<RequisitesMessageKeyValue, `requisites.validation.${string}`>;

const VIOLATION_KEYS: ReadonlyMap<string, ViolationKeyValue> = new Map<string, ViolationKeyValue>([
  ['field_check.bik', 'requisites.validation.field_check.bik'],
  ['field_check.correspondent_account', 'requisites.validation.field_check.correspondent_account'],
  ['field_check.settlement_account', 'requisites.validation.field_check.settlement_account'],
]);

export const translateRequisitesViolation = (t: RequisitesTranslate, ruleId: string): string | undefined => {
  const key = VIOLATION_KEYS.get(ruleId);

  return key === undefined ? undefined : t(key);
};
