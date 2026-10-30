import type { FormFieldCheckKindValue } from '../formRuleTypes';

const FIELD_CHECK_RULE_PREFIX = 'field_check.';

export const getFieldCheckRuleId = (kind: FormFieldCheckKindValue): string =>
  `${FIELD_CHECK_RULE_PREFIX}${kind.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`;
