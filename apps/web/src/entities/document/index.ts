export type { DocumentIndexEntryValue } from './api/documentIndex';
export { useDocumentIndexQuery } from './api/documentIndexQuery';
export type { DocumentSummaryValue } from './api/documentQueries';
export {
  documentListMethod,
  fetchDealDocuments,
  useDealDocumentQuery,
  useDealDocumentsQuery,
} from './api/documentQueries';
export {
  getSignDealDocumentMethod,
  useSignDealDocument,
} from './api/useSignDealDocument';
export { getDocumentTypeLabel } from './i18n/documentTypeLabel';
export {
  documentTypeSection,
  type DocumentTypeTranslate,
} from './i18n/documentTypeSection';
export { canSignDealDocument } from './lib/canSignDealDocument';
