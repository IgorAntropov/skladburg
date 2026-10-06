import type { MessageOverridesValue } from '../localizer/localizationTypes';
import type {
  LocaleCode,
  MessageValue,
  PluralCategory,
  PluralFormsValue,
} from '../localizer/messageShape';

import { extractPlaceholders } from '../localizer/messageShape';
import { getPluralRules } from './intlCache';

const PLURAL_CATEGORIES: readonly PluralCategory[] = [
  'zero',
  'one',
  'two',
  'few',
  'many',
  'other',
];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const hasExactCategories = (value: Readonly<Record<string, unknown>>, locale: LocaleCode): boolean => {
  const expectedCategories = [...getPluralRules(locale).resolvedOptions().pluralCategories].sort();
  const actualCategories = Object.keys(value).sort();

  return expectedCategories.length === actualCategories.length
    && expectedCategories.every((category, index) => category === actualCategories[index]);
};

const parsePluralForms = (
  value: Readonly<Record<string, unknown>>,
  locale: LocaleCode,
): PluralFormsValue | undefined => {
  if (!hasExactCategories(value, locale)) {
    return undefined;
  }

  const forms: Partial<Record<PluralCategory, string>> = {};

  for (const category of PLURAL_CATEGORIES) {
    if (!Object.hasOwn(value, category)) {
      continue;
    }

    const form = value[category];

    if (typeof form !== 'string') {
      return undefined;
    }

    forms[category] = form;
  }

  const { other } = forms;

  return other === undefined ? undefined : { ...forms, other };
};

const parseMessage = (value: unknown, locale: LocaleCode): MessageValue | undefined => {
  if (typeof value === 'string') {
    return value;
  }

  return isRecord(value) ? parsePluralForms(value, locale) : undefined;
};

const hasSameShape = (message: MessageValue, reference: MessageValue): boolean => {
  const isTextMessage = typeof message === 'string';

  if (isTextMessage !== (typeof reference === 'string')) {
    return false;
  }

  const placeholders = extractPlaceholders(message);
  const referencePlaceholders = extractPlaceholders(reference);

  return placeholders.length === referencePlaceholders.length
    && placeholders.every((name, index) => name === referencePlaceholders[index]);
};

export const sanitizeOverrides = (
  overrides: unknown,
  reference: MessageOverridesValue,
  locale: LocaleCode,
): MessageOverridesValue => {
  if (!isRecord(overrides)) {
    return {};
  }

  const sanitized: Partial<Record<string, MessageValue>> = {};

  for (const [key, candidate] of Object.entries(overrides)) {
    const referenceMessage = Object.hasOwn(reference, key) ? reference[key] : undefined;
    const message = parseMessage(candidate, locale);

    if (referenceMessage !== undefined && message !== undefined && hasSameShape(message, referenceMessage)) {
      sanitized[key] = message;
    }
  }

  return sanitized;
};
