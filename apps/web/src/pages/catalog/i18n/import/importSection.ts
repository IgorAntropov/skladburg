import type { LocaleCode } from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './ru';

export const importSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./ru').then(loaded => loaded.catalog) },
  prefix: 'dataImport',
});

type CatalogImportRuleKey = Extract<keyof typeof catalog, `dataImport.rule.${string}`>;

export const findCatalogImportRuleKey = (locale: LocaleCode, ruleId: string): CatalogImportRuleKey | undefined => {
  const messages = importSection.read(locale).catalog;
  const key = `dataImport.rule.${ruleId}`;
  const isRuleKey = (value: string): value is CatalogImportRuleKey => messages !== undefined && Object.hasOwn(messages, value);

  return isRuleKey(key) ? key : undefined;
};
