import { DocumentType } from '@skladburg/contracts/document/v1/document';

import type {
  DocumentTypeKeyValue,
  DocumentTypeTranslate,
} from './documentTypeSection';

const DOCUMENT_TYPE_KEYS: Readonly<Partial<Record<DocumentType, DocumentTypeKeyValue>>> = {
  [DocumentType.DISPATCH_TITLE]: 'documentType.dispatchTitle',
  [DocumentType.INVOICE]: 'documentType.invoice',
  [DocumentType.RECEIPT_CLAIM]: 'documentType.receiptClaim',
  [DocumentType.RECEIPT_DISCREPANCY_ACT]: 'documentType.receiptDiscrepancyAct',
  [DocumentType.RECEIPT_TITLE]: 'documentType.receiptTitle',
  [DocumentType.SPECIFICATION]: 'documentType.specification',
  [DocumentType.SUPPLY_CONTRACT]: 'documentType.contract',
  [DocumentType.UNSPECIFIED]: 'documentType.generic',
  [DocumentType.UPD]: 'documentType.upd',
};

export const getDocumentTypeKey = (type: DocumentType | undefined): DocumentTypeKeyValue =>
  DOCUMENT_TYPE_KEYS[type ?? DocumentType.UNSPECIFIED] ?? 'documentType.generic';

export const getDocumentTypeLabel = (type: DocumentType | undefined, t: DocumentTypeTranslate): string =>
  t(getDocumentTypeKey(type));
