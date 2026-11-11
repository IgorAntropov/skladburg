import type {
  LocaleCode,
  SectionTranslate,
} from '@/shared/i18n';

import { createCatalogSection } from '@/shared/i18n';

import type { catalog } from './warehouseImportRu';

export type WarehouseImportTranslate = SectionTranslate<typeof catalog>;

export const warehouseImportSection = createCatalogSection<typeof catalog>({
  loaders: { ru: () => import('./warehouseImportRu').then(loaded => loaded.catalog) },
  prefix: 'warehouseImport',
});

type WarehouseImportRuleKey = Extract<keyof typeof catalog, `dataImport.rule.${string}`>;

export const findWarehouseImportRuleKey = (locale: LocaleCode, ruleId: string): undefined | WarehouseImportRuleKey => {
  const messages = warehouseImportSection.read(locale).catalog;
  const key = `dataImport.rule.${ruleId}`;
  const isRuleKey = (value: string): value is WarehouseImportRuleKey => messages !== undefined && Object.hasOwn(messages, value);

  return isRuleKey(key) ? key : undefined;
};
