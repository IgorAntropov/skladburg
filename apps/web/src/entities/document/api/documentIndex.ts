import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  DealService,
  DealStatus,
} from '@skladburg/contracts/deal/v1/deal';

import type { ApiClient } from '@/shared/api';
import type { LocaleCode } from '@/shared/i18n';

import { collectPages } from '@/shared/api';

import type { DocumentSummaryValue } from './documentQueries';

import { getDocumentTypeKey } from '../i18n/documentTypeLabel';
import { documentTypeSection } from '../i18n/documentTypeSection';
import { fetchDealDocuments } from './documentQueries';

const DOCUMENT_REQUEST_CONCURRENCY = 4;

export interface DocumentIndexEntryValue {
  dealId: string;
  displayTitle: string;
  document: DocumentSummaryValue;
  title: string;
}

const getDocumentContextPriority = (status: DealStatus): number => {
  if (status === DealStatus.LOGISTICS_CHOSEN) {
    return 0;
  }

  return status === DealStatus.CANCELLED ? 2 : 1;
};

export const fetchDocumentIndex = async (
  client: ApiClient,
  locale: LocaleCode,
  signal: AbortSignal,
): Promise<DocumentIndexEntryValue[]> => {
  const [deals, labels] = await Promise.all([
    collectPages(async (page) => {
      signal.throwIfAborted();
      const response = await client.service(DealService).listDeals({ page }, { signal });
      const items = response.deals.filter(deal => deal.deliveryMethod !== DeliveryMethod.UNSPECIFIED);

      return { items, nextPageToken: response.page?.nextPageToken ?? '' };
    }),
    documentTypeSection.load(locale),
  ]);
  const prioritizedDeals = deals.toSorted((current, prev) =>
    getDocumentContextPriority(current.status) - getDocumentContextPriority(prev.status));
  const index = new Map<string, DocumentIndexEntryValue>();
  const formatNumber = new Intl.NumberFormat(locale);

  for (let offset = 0; offset < prioritizedDeals.length; offset += DOCUMENT_REQUEST_CONCURRENCY) {
    signal.throwIfAborted();
    const batch = prioritizedDeals.slice(offset, offset + DOCUMENT_REQUEST_CONCURRENCY);
    const lists = await Promise.all(batch.map(async deal => ({
      deal,
      documents: await fetchDealDocuments(client, deal.id, signal),
    })));

    for (const { deal, documents } of lists) {
      for (const document of documents) {
        if (!index.has(document.id)) {
          const typeLabel = labels[getDocumentTypeKey(document.type)];
          const title = document.displayNumber === '' ? typeLabel : `${typeLabel} № ${document.displayNumber}`;
          const dealLabel = labels['documentType.dealReference'].replace('{number}', formatNumber.format(deal.number));

          index.set(document.id, {
            dealId: deal.id,
            displayTitle: `${title} · ${dealLabel}`,
            document,
            title,
          });
        }
      }
    }
  }

  return [...index.values()];
};
