import type { MessageKey } from '@/shared/i18n';

const GENERIC_VIOLATION_MESSAGE_KEY = 'validation.invalid' satisfies MessageKey;

const VIOLATION_MESSAGE_KEYS: ReadonlyMap<string, MessageKey> = new Map<string, MessageKey>([
  ['enum.defined_only', 'validation.enum.defined_only'],
  ['enum.not_in', 'validation.enum.not_in'],
  ['int32.gte_lte', 'validation.int32.gte_lte'],
  ['page_token.invalid', 'validation.page_token.invalid'],
  ['repeated.unique', 'validation.repeated.unique'],
  ['required', 'validation.required'],
  ['string.max_len', 'validation.string.max_len'],
  ['string.min_len', 'validation.string.min_len'],
  ['string.pattern', 'validation.string.pattern'],
  ['string.uuid', 'validation.string.uuid'],
  ['string.uuid_empty', 'validation.string.uuid_empty'],
]);

export const getViolationMessageKey = (ruleId: string): MessageKey =>
  VIOLATION_MESSAGE_KEYS.get(ruleId) ?? GENERIC_VIOLATION_MESSAGE_KEY;
