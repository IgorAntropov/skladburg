import type { FormFieldCheckKindValue } from '../formRuleTypes';

const FIELD_CHECK_ENUM_PREFIX = 'FIELD_CHECK_';

const KIND_REGISTRY: Readonly<Record<FormFieldCheckKindValue, true>> = {
  bik: true,
  correspondentAccount: true,
  gtin: true,
  inn: true,
  kpp: true,
  ogrn: true,
  settlementAccount: true,
};

const FIELD_CHECK_KINDS: ReadonlySet<string> = new Set(Object.keys(KIND_REGISTRY));

const isFieldCheckKind = (value: string): value is FormFieldCheckKindValue => FIELD_CHECK_KINDS.has(value);

export const toFieldCheckKind = (enumValueName: string): FormFieldCheckKindValue | undefined => {
  if (!enumValueName.startsWith(FIELD_CHECK_ENUM_PREFIX)) {
    return undefined;
  }

  const kind = enumValueName
    .slice(FIELD_CHECK_ENUM_PREFIX.length)
    .toLowerCase()
    .replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());

  return isFieldCheckKind(kind) ? kind : undefined;
};
