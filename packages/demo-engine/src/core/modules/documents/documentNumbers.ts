import type { Document } from '@skladburg/contracts/document/v1/document';

import { create } from '@bufbuild/protobuf';
import { CalendarDateSchema } from '@skladburg/contracts/common/v1/date';
import {
  DocumentNumberSequenceSchema,
  DocumentType,
} from '@skladburg/contracts/document/v1/document';

import type { IDomainErrors } from '../../errors/index';
import type { IStateTransaction } from '../../state/index';

import { toCalendarDate } from '../../calendar/index';

export const assignDocumentNumber = (errors: IDomainErrors, transaction: IStateTransaction, document: Document): void => {
  const issuer = document.issuerOrganizationId;
  const timeZone = transaction.get('organizationRequisites', issuer)?.timeZone;
  if (timeZone === undefined) {
    throw errors.unavailable();
  }

  const date = toCalendarDate(transaction.worldTimeMs, timeZone);
  const id = `${issuer}:${String(document.type)}:${String(date.year)}`;
  const number = (transaction.get('documentNumbers', id)?.lastNumber ?? 0) + 1;
  if (number > 2_147_483_647) {
    throw errors.unavailable();
  }

  const prefixes = transaction.get('organizationSettings', issuer)?.documentNumberPrefixes;
  const prefixByType = {
    [DocumentType.INVOICE]: prefixes?.invoice,
    [DocumentType.SPECIFICATION]: prefixes?.specification,
    [DocumentType.SUPPLY_CONTRACT]: prefixes?.supplyContract,
    [DocumentType.UNSPECIFIED]: undefined,
  } satisfies Record<DocumentType, string | undefined>;

  transaction.put('documentNumbers', create(DocumentNumberSequenceSchema, { id, lastNumber: number }));
  document.number = number;
  document.date = create(CalendarDateSchema, date);
  document.displayNumber = `${prefixByType[document.type] ?? ''}${String(number)}`;
};
