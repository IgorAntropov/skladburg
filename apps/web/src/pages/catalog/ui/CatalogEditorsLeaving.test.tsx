import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  BaseUnit,
  CatalogService,
  GetOwnListingResponseSchema,
  GetSalesTermsResponseSchema,
  ListingSchema,
  ListListingPricesResponseSchema,
  OwnListingSchema,
  ProductSchema,
  SalesTermsSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  useOwnListingQuery,
  useSalesTermsQuery,
} from '@/entities/listing';
import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import {
  formatAddressPath,
  RoutingProvider,
} from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';
import { LiveRegionProvider } from '@/shared/ui';

import { toOwnListingPair } from '../lib/toOwnListingPairs';
import { CatalogTextsGate } from './CatalogTextsGate';
import { ListingEditor } from './listing-editor/ListingEditor';
import { SalesTermsForm } from './sales-terms/SalesTermsForm';

vi.mock('@/entities/session', () => ({
  useCan: () => true,
  useCommandAccess: () => ({ status: 'allowed' }),
}));

vi.mock('../api/useOwnWarehouseOptions', () => ({
  useOwnWarehouseOptions: () => ({
    cityNames: new Map<string, string>(),
    error: null,
    isPending: false,
    isRetrying: false,
    options: [],
    retry: () => undefined,
  }),
}));

const LISTING_ID = 'b0000001-0000-4000-8000-000000000001';
const OTHER_LISTING_ID = 'b0000001-0000-4000-8000-000000000002';
const PRODUCT_ID = 'b0000002-0000-4000-8000-000000000001';

const OWN_LISTING_PATH = formatAddressPath({ kind: 'object', object: { id: LISTING_ID, type: 'listing' } });
const OTHER_LISTING_PATH = formatAddressPath({ kind: 'object', object: { id: OTHER_LISTING_ID, type: 'listing' } });
const CATALOG_PATH = formatAddressPath({ kind: 'section', section: 'catalog' });
const DEALS_PATH = formatAddressPath({ kind: 'section', section: 'deals' });

const Harness = (): null | ReactElement => {
  const listing = useOwnListingQuery(LISTING_ID).data;
  const terms = useSalesTermsQuery().data;
  const pair = listing === undefined ? undefined : toOwnListingPair(listing);

  if (pair === undefined || terms === undefined) {
    return null;
  }

  return (
    <>
      <ListingEditor onClose={() => undefined} pair={pair} />
      <SalesTermsForm onClose={() => undefined} terms={terms} />
    </>
  );
};

const renderEditors = async (): Promise<ReturnType<typeof createMemoryLocation>> => {
  const location = createMemoryLocation(OWN_LISTING_PATH);
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(CatalogService, {
        getOwnListing: () => create(GetOwnListingResponseSchema, {
          listing: create(OwnListingSchema, {
            listing: create(ListingSchema, {
              id: LISTING_ID,
              minOrderQuantity: 480000n,
              orderStep: 1000n,
              priceUnit: { baseQuantity: 1000n, name: 'кг' },
              productId: PRODUCT_ID,
              version: 4n,
            }),
            product: create(ProductSchema, { baseUnit: BaseUnit.GRAM, id: PRODUCT_ID, name: 'Яблоки Голден' }),
          }),
        }),
        getSalesTerms: () => create(GetSalesTermsResponseSchema, {
          terms: create(SalesTermsSchema, {
            organizationId: 'a0000001-0000-4000-8000-000000000009',
            preparationWorkingDays: 1,
            version: 3n,
          }),
        }),
        listListingPrices: () => create(ListListingPricesResponseSchema, { prices: [] }),
      });
    },
  });

  render(withTestLocalizer(
    <RoutingProvider location={location}>
      <LiveRegionProvider>
        <ApiRuntimeProvider runtime={runtime}>
          <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
            <CatalogTextsGate skeleton={null}>
              <Harness />
            </CatalogTextsGate>
          </QueryClientProvider>
        </ApiRuntimeProvider>
      </LiveRegionProvider>
    </RoutingProvider>,
  ));
  await screen.findByTestId('listing-save');
  await screen.findByTestId('sales-terms-save');

  return location;
};

const changeListing = (): void => {
  const input = document.querySelector('[data-testid="listing-unit-name"] input');

  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('The unit name is not an input');
  }

  fireEvent.change(input, { target: { value: 'ящик' } });
};

const changeSalesTerms = (): void => {
  act(() => {
    within(screen.getByTestId('sales-terms-auto-confirm')).getByRole('switch').click();
  });
};

const countQuestions = (): number => document.querySelectorAll('[data-testid$="-leave-confirm"]').length;

describe('the editors of the catalog that have unsaved changes at the same time', () => {
  afterEach(() => {
    cleanup();
  });

  it('asks only the editor of the position on a move to another position and keeps the sales terms', async () => {
    const location = await renderEditors();
    changeListing();
    changeSalesTerms();

    act(() => {
      location.navigate(OTHER_LISTING_PATH);
    });

    expect(screen.getByTestId('listing-editor-leave-confirm')).toBeTruthy();
    expect(screen.queryByTestId('sales-terms-leave-confirm')).toBeNull();
    expect(location.read().path).toBe(OWN_LISTING_PATH);

    act(() => {
      screen.getByTestId('listing-editor-leave-confirm-leave').click();
    });

    expect(location.read().path).toBe(OTHER_LISTING_PATH);
    expect(within(screen.getByTestId('sales-terms-auto-confirm')).getByRole('switch')).toHaveProperty('checked', true);
  });

  it('does not ask the sales terms on moves inside the catalog when only they have changes', async () => {
    const location = await renderEditors();
    changeSalesTerms();

    act(() => {
      location.navigate(OTHER_LISTING_PATH);
    });
    act(() => {
      location.navigate(CATALOG_PATH);
    });

    expect(location.read().path).toBe(CATALOG_PATH);
    expect(countQuestions()).toBe(0);
  });

  it('asks once on a move out of the catalog and drops the question the other editor already had', async () => {
    const location = await renderEditors();
    changeListing();
    changeSalesTerms();
    act(() => {
      screen.getByTestId('listing-editor-back').click();
    });

    expect(countQuestions()).toBe(1);
    expect(screen.getByTestId('listing-editor-leave-confirm')).toBeTruthy();

    act(() => {
      location.navigate(DEALS_PATH);
    });

    expect(countQuestions()).toBe(1);
    expect(screen.getByTestId('sales-terms-leave-confirm')).toBeTruthy();
    expect(location.read().path).toBe(OWN_LISTING_PATH);

    act(() => {
      screen.getByTestId('sales-terms-leave-confirm-leave').click();
    });

    expect(location.read().path).toBe(DEALS_PATH);
    expect(countQuestions()).toBe(0);
  });
});
