import { DocumentType } from '@skladburg/contracts/document/v1/document';

import type {
  DocumentTypeKeyValue,
  DocumentTypeTranslate,
} from './documentTypeSection';

const DOCUMENT_TYPE_KEYS: Readonly<Partial<Record<DocumentType, DocumentTypeKeyValue>>> = {
  [DocumentType.INVOICE]: 'documentType.invoice',
  [DocumentType.SPECIFICATION]: 'documentType.specification',
  [DocumentType.SUPPLY_CONTRACT]: 'documentType.contract',
  [DocumentType.UNSPECIFIED]: 'documentType.generic',
};

export const getDocumentTypeKey = (type: DocumentType | undefined): DocumentTypeKeyValue =>
  DOCUMENT_TYPE_KEYS[type ?? DocumentType.UNSPECIFIED] ?? 'documentType.generic';

export const getDocumentTypeLabel = (type: DocumentType | undefined, t: DocumentTypeTranslate): string =>
  t(getDocumentTypeKey(type));
