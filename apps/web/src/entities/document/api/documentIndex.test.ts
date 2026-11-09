import { create } from '@bufbuild/protobuf';
import { DeliveryMethod } from '@skladburg/contracts/catalog/v1/showcase';
import {
  DealService,
  DealStatus,
  ListDealsResponseSchema,
} from '@skladburg/contracts/deal/v1/deal';
import {
  DocumentService,
  DocumentType,
  ListDealDocumentsResponseSchema,
} from '@skladburg/contracts/document/v1/document';
import {
  expect,
  it,
} from 'vitest';

import { createTestRuntime } from '@/shared/api/index.testing';

import { fetchDocumentIndex } from './documentIndex';

const createLatch = (): { open: () => void; promise: Promise<void> } => {
  let open = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { open, promise };
};

it('collects all deal and document pages while limiting concurrent document requests', async () => {
  const started = createLatch();
  const release = createLatch();
  const requests: string[] = [];
  const { client } = createTestRuntime({
    routes: (router) => {
      router.service(DealService, {
        listDeals: ({ page }) => {
          const isFirstPage = page?.pageToken === '';

          return create(ListDealsResponseSchema, {
            deals: (isFirstPage ? [5, 4, 3] : [2, 1]).map(number => ({
              deliveryMethod: DeliveryMethod.SUPPLIER,
              id: `deal-${String(number)}`,
              number,
            })),
            page: { nextPageToken: isFirstPage ? 'next-deal' : '' },
          });
        },
      });
      router.service(DocumentService, {
        listDealDocuments: async ({ dealId, page }) => {
          requests.push(dealId);
          if (requests.length === 4) {
            started.open();
          }
          await release.promise;

          const hasMore = dealId === 'deal-1' && page?.pageToken === '';
          const id = page?.pageToken === 'next-document' ? 'last-invoice' : `invoice-${dealId}`;

          return create(ListDealDocumentsResponseSchema, {
            documents: [{ displayNumber: '17', id, type: DocumentType.INVOICE }],
            page: { nextPageToken: hasMore ? 'next-document' : '' },
          });
        },
      });
    },
  });

  const index = fetchDocumentIndex(client, 'ru', new AbortController().signal);

  try {
    await started.promise;
    expect(requests).toEqual(['deal-5', 'deal-4', 'deal-3', 'deal-2']);
  }
  finally {
    release.open();
  }

  expect((await index).map(({ dealId, document }) => [dealId, document.id])).toEqual([
    ['deal-5', 'invoice-deal-5'],
    ['deal-4', 'invoice-deal-4'],
    ['deal-3', 'invoice-deal-3'],
    ['deal-2', 'invoice-deal-2'],
    ['deal-1', 'invoice-deal-1'],
    ['deal-1', 'last-invoice'],
  ]);
});

it.each([
  DealStatus.LOGISTICS_CHOSEN,
  DealStatus.AWAITING_PAYMENT,
])('resolves a shared contract through the active deal at status %s', async (status) => {
  const { client } = createTestRuntime({
    routes: (router) => {
      router.service(DealService, {
        listDeals: () => create(ListDealsResponseSchema, {
          deals: [
            { deliveryMethod: DeliveryMethod.SUPPLIER, id: 'cancelled', number: 2, status: DealStatus.CANCELLED },
            { deliveryMethod: DeliveryMethod.SUPPLIER, id: 'active', number: 1, status },
          ],
        }),
      });
      router.service(DocumentService, {
        listDealDocuments: () => create(ListDealDocumentsResponseSchema, {
          documents: [{ id: 'shared-contract', type: DocumentType.SUPPLY_CONTRACT }],
        }),
      });
    },
  });

  const index = await fetchDocumentIndex(client, 'ru', new AbortController().signal);

  expect(index).toHaveLength(1);
  expect(index[0]).toMatchObject({ dealId: 'active', document: { id: 'shared-contract' } });
});
