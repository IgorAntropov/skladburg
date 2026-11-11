import type { ImportTemplate } from '@skladburg/contracts/import/v1/import';

import type {
  MessageKey,
  Translate,
} from '@/shared/i18n';

import { getViolationMessageKey } from '@/shared/api';

import type { ImportOptionsValue } from '../model/importOptions';

const isValidationKey = (key: MessageKey): key is Extract<MessageKey, `validation.${string}`> => key.startsWith('validation.');

interface ImportRowIssueValue {
  columnNumber: number;
  fieldPath: string;
  rowNumber: number;
  ruleId: string;
}

export const formatImportIssue = (
  { getRuleMessage, t }: ImportOptionsValue,
  mainT: Translate,
  template: ImportTemplate | undefined,
  issue: ImportRowIssueValue,
): string => {
  const { columnNumber, fieldPath, rowNumber, ruleId } = issue;
  const fallback = getViolationMessageKey(ruleId);
  const message = getRuleMessage(ruleId) ?? mainT(isValidationKey(fallback) ? fallback : 'validation.invalid');
  const column = template?.columns.find(item => item.fieldPath === fieldPath || fieldPath.startsWith(`${item.fieldPath}.`));
  const label = fieldPath === 'gtin' ? 'GTIN' : column?.aliases[0];
  const number = columnNumber > 0 ? t('dataImport.column', { column: columnNumber }) : undefined;
  const field = [label, number].filter(Boolean).join(' · ');

  return field === ''
    ? t('dataImport.rowErrorWithoutField', { message, row: rowNumber })
    : t('dataImport.rowError', { field, message, row: rowNumber });
};
