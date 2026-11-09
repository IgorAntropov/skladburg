import type { CalendarDate } from '@skladburg/contracts/common/v1/date';

import { DocumentStatus } from '@skladburg/contracts/document/v1/document';

import type { DealDocumentTranslate } from './documentSection';

export const DOCUMENT_STATUS_KEYS = {
  [DocumentStatus.ANNULLED]: 'dealDocument.status.annulled',
  [DocumentStatus.APPROVED]: 'dealDocument.status.approved',
  [DocumentStatus.DRAFT]: 'dealDocument.status.draft',
  [DocumentStatus.SIGNED]: 'dealDocument.status.signed',
  [DocumentStatus.UNSPECIFIED]: 'dealDocument.status.unknown',
} as const;

export const formatDocumentNumberAndDate = (
  number: string,
  date: CalendarDate | undefined,
  formatDate: (date: CalendarDate) => string,
  t: DealDocumentTranslate,
): string => {
  if (number === '' && date === undefined) {
    return t('dealDocument.notIssued');
  }

  return t('dealDocument.numberAndDate', {
    date: date === undefined ? t('dealDocument.notSpecified') : formatDate(date),
    number: number || t('dealDocument.notSpecified'),
  });
};
