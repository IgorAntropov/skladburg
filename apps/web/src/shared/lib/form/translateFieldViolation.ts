import type {
  MessageKey,
  Translate,
} from '@/shared/i18n';

import { getViolationMessageKey } from '@/shared/api';

type ViolationMessageKeyValue = Extract<MessageKey, `validation.${string}`>;

const isViolationMessageKey = (key: MessageKey): key is ViolationMessageKeyValue => key.startsWith('validation.');

export const translateFieldViolation = (t: Translate, ruleId: string): string => {
  const key = getViolationMessageKey(ruleId);

  return isViolationMessageKey(key) ? t(key) : t('validation.invalid');
};
