export type CatalogShapeValue = Readonly<Record<string, MessageValue>>;

export type LocaleCode = string;

export type MessageValue = PluralFormsValue | string;

export type PluralCategory = Intl.LDMLPluralRule;

export type PluralFormsValue = Readonly<Partial<Record<PluralCategory, string>> & { other: string }>;

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

export const extractPlaceholders = (message: MessageValue): string[] => {
  const texts = typeof message === 'string' ? [message] : Object.values(message);
  const names = texts.flatMap(text => Array.from(text.matchAll(PLACEHOLDER_PATTERN), match => match[1] ?? ''));

  return [...new Set(names)].sort();
};
