import type { ImportTemplate } from '@skladburg/contracts/import/v1/import';

import type {
  MessageKey,
  Translate,
} from '@/shared/i18n';

import { getViolationMessageKey } from '@/shared/api';

import type { ImportTranslate } from '../../i18n/import/importSection';
import type { catalog } from '../../i18n/import/ru';

type ImportRuleKeyValue = Extract<keyof typeof catalog, `catalogImport.rule.${string}`>;

const IMPORT_RULE_KEYS: ReadonlyMap<string, ImportRuleKeyValue> = new Map<string, ImportRuleKeyValue>([
  ['catalog.gtin_taken', 'catalogImport.rule.catalog.gtin_taken'],
  ['catalog.min_order_not_multiple_of_step', 'catalogImport.rule.catalog.min_order_not_multiple_of_step'],
  ['catalog.min_price_above_tier', 'catalogImport.rule.catalog.min_price_above_tier'],
  ['catalog.price_below_minimum', 'catalogImport.rule.catalog.price_below_minimum'],
  ['catalog.sku_taken', 'catalogImport.rule.catalog.sku_taken'],
  ['catalog.sphere_exists', 'catalogImport.rule.catalog.sphere_exists'],
  ['catalog.temperature_range_order', 'catalogImport.rule.catalog.temperature_range_order'],
  ['field_check.gtin', 'catalogImport.rule.field_check.gtin'],
  ['import.columns', 'catalogImport.rule.import.columns'],
  ['import.decimal', 'catalogImport.rule.import.decimal'],
  ['import.enum', 'catalogImport.rule.import.enum'],
  ['import.identifier_taken', 'catalogImport.rule.import.identifier_taken'],
  ['import.integer', 'catalogImport.rule.import.integer'],
  ['import.sphere_ambiguous', 'catalogImport.rule.import.sphere_ambiguous'],
  ['import.temperature_pair', 'catalogImport.rule.import.temperature_pair'],
  ['int64.gt', 'catalogImport.rule.int64.gt'],
  ['int64.gte', 'catalogImport.rule.int64.gte'],
]);

const isValidationKey = (key: MessageKey): key is Extract<MessageKey, `validation.${string}`> => key.startsWith('validation.');

interface ImportRowIssueValue {
  columnNumber: number;
  fieldPath: string;
  rowNumber: number;
  ruleId: string;
}

export const formatImportIssue = (
  t: ImportTranslate,
  mainT: Translate,
  template: ImportTemplate | undefined,
  issue: ImportRowIssueValue,
): string => {
  const { columnNumber, fieldPath, rowNumber, ruleId } = issue;
  const rule = IMPORT_RULE_KEYS.get(ruleId);
  const fallback = getViolationMessageKey(ruleId);
  const message = rule === undefined ? mainT(isValidationKey(fallback) ? fallback : 'validation.invalid') : t(rule);
  const column = template?.columns.find(item => item.fieldPath === fieldPath || fieldPath.startsWith(`${item.fieldPath}.`));
  const label = fieldPath === 'gtin' ? 'GTIN' : column?.aliases[0];
  const number = columnNumber > 0 ? t('catalogImport.column', { column: columnNumber }) : undefined;
  const field = [label, number].filter(Boolean).join(' · ');

  return field === ''
    ? t('catalogImport.rowErrorWithoutField', { message, row: rowNumber })
    : t('catalogImport.rowError', { field, message, row: rowNumber });
};
