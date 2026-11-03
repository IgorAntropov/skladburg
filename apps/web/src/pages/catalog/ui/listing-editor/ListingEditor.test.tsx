import type {
  SaveListingPriceRequest,
  SaveListingRequest,
  SetListingPublishedRequest,
} from '@skladburg/contracts/catalog/v1/catalog';
import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  AvailabilityStatus,
  BaseUnit,
  CatalogService,
  GetOwnListingResponseSchema,
  ListingPriceSchema,
  ListingSchema,
  ListListingPricesResponseSchema,
  OwnListingSchema,
  ProductSchema,
  SaveListingPriceResponseSchema,
  SaveListingResponseSchema,
  SetListingPublishedResponseSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  ErrorCode,
  ErrorDetailSchema,
  FieldViolationSchema,
  ValidationFailedParamsSchema,
} from '@skladburg/contracts/common/v1/error';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { useOwnListingQuery } from '@/entities/listing';
import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { LiveRegionProvider } from '@/shared/ui';

import type { DestinationOptionValue } from '../../lib/destinationOptions';

import { toOwnListingPair } from '../../lib/toOwnListingPairs';
import { CatalogTextsGate } from '../CatalogTextsGate';
import { ListingEditor } from './ListingEditor';

type ListingValue = ReturnType<typeof create<typeof ListingSchema>>;
type PriceValue = ReturnType<typeof create<typeof ListingPriceSchema>>;

interface ServerValue {
  listing: ListingValue;
  price: PriceValue | undefined;
  publish: ReturnType<typeof vi.fn<(request: SetListingPublishedRequest) => void>>;
  saveListing: ReturnType<typeof vi.fn<(request: SaveListingRequest) => void>>;
  savePrice: ReturnType<typeof vi.fn<(request: SaveListingPriceRequest) => void>>;
}

vi.mock('@/entities/session', () => ({
  useCan: () => true,
  useCommandAccess: () => ({ status: 'allowed' }),
}));

const mockedWarehouses: DestinationOptionValue[] = [];

vi.mock('../../api/useOwnWarehouseOptions', () => ({
  useOwnWarehouseOptions: () => ({
    cityNames: new Map<string, string>(),
    error: null,
    isPending: false,
    isRetrying: false,
    options: mockedWarehouses,
    retry: () => undefined,
  }),
}));

const LISTING_ID = 'b0000001-0000-4000-8000-000000000001';
const PRODUCT_ID = 'b0000002-0000-4000-8000-000000000001';
const MOSCOW = 'a0000001-0000-4000-8000-000000000001';
const KAZAN = 'a0000001-0000-4000-8000-000000000002';
const TVER = 'a0000001-0000-4000-8000-000000000003';
const RUB = 'RUB';

interface TierInitValue {
  minQuantity: bigint;
  price: { amountMinor: bigint; currencyCode: string };
}

const createTier = (minQuantity: bigint, amountMinor: bigint): TierInitValue => ({
  minQuantity,
  price: { amountMinor, currencyCode: RUB },
});

const createListing = (
  availability: { quantity: bigint; status: AvailabilityStatus; warehouseId: string }[] = [],
): ListingValue => create(ListingSchema, {
  availability,
  id: LISTING_ID,
  minOrderQuantity: 480000n,
  orderStep: 1000n,
  priceUnit: { baseQuantity: 1000n, name: 'кг' },
  productId: PRODUCT_ID,
  sphereIds: ['c0000001-0000-4000-8000-000000000001'],
  version: 4n,
});

const createPrice = (tiers: TierInitValue[]): PriceValue => create(ListingPriceSchema, {
  listingId: LISTING_ID,
  tiers,
  version: 2n,
});

const createValidationError = (violations: [string, string][]): ConnectError => new ConnectError(
  'failed',
  Code.FailedPrecondition,
  undefined,
  [{
    desc: ErrorDetailSchema,
    value: create(ErrorDetailSchema, {
      code: ErrorCode.VALIDATION_FAILED,
      params: {
        case: 'validationFailed',
        value: create(ValidationFailedParamsSchema, {
          violations: violations.map(([fieldPath, ruleId]) => create(FieldViolationSchema, { fieldPath, ruleId })),
        }),
      },
    }),
  }],
);

const createVersionConflict = (): ConnectError => new ConnectError(
  'conflict',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code: ErrorCode.VERSION_CONFLICT }) }],
);

const createServer = (listing: ListingValue, price: PriceValue | undefined): ServerValue => {
  const server: ServerValue = {
    listing,
    price,
    publish: vi.fn<(request: SetListingPublishedRequest) => void>(),
    saveListing: vi.fn<(request: SaveListingRequest) => void>(),
    savePrice: vi.fn<(request: SaveListingPriceRequest) => void>(),
  };

  return server;
};

const Harness = (): null | ReactElement => {
  const { data } = useOwnListingQuery(LISTING_ID);
  const pair = data === undefined ? undefined : toOwnListingPair(data);

  return pair === undefined ? null : <ListingEditor onClose={() => undefined} pair={pair} />;
};

const renderEditor = (server: ServerValue): void => {
  const product = create(ProductSchema, {
    baseUnit: BaseUnit.GRAM,
    id: PRODUCT_ID,
    minPrice: { amountMinor: 7000n, currencyCode: RUB },
    name: 'Яблоки Голден',
  });
  const runtime = createTestRuntime({
    routes: (router) => {
      router.service(CatalogService, {
        getOwnListing: () => create(GetOwnListingResponseSchema, {
          listing: create(OwnListingSchema, { listing: server.listing, product }),
        }),
        listListingPrices: () => create(ListListingPricesResponseSchema, {
          prices: server.price === undefined ? [] : [server.price],
        }),
        saveListing: (request) => {
          server.saveListing(request);

          return create(SaveListingResponseSchema, { listing: server.listing });
        },
        saveListingPrice: (request) => {
          server.savePrice(request);

          return create(SaveListingPriceResponseSchema, { price: server.price });
        },
        setListingPublished: (request) => {
          server.publish(request);

          return create(SetListingPublishedResponseSchema, { listing: server.listing });
        },
      });
    },
  });

  render(withTestLocalizer(
    <LiveRegionProvider>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={createQueryClient({ networkMode: 'always' })}>
          <CatalogTextsGate skeleton={null}>
            <Harness />
          </CatalogTextsGate>
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </LiveRegionProvider>,
  ));
};

const getInput = (testId: string): HTMLInputElement => {
  const element = document.querySelector(`[data-testid="${testId}"] input`);

  if (!(element instanceof HTMLInputElement)) {
    throw new TypeError(`The field ${testId} is not an input`);
  }

  return element;
};

const getSelect = (testId: string): HTMLSelectElement => {
  const element = document.querySelector(`[data-testid="${testId}"] select`);

  if (!(element instanceof HTMLSelectElement)) {
    throw new TypeError(`The field ${testId} is not a select`);
  }

  return element;
};

const typeText = (input: HTMLInputElement, text: string): void => {
  for (const symbol of text) {
    const caret = input.selectionStart ?? input.value.length;
    const nextValue = input.value.slice(0, caret) + symbol + input.value.slice(input.selectionEnd ?? caret);

    act(() => {
      Reflect.set(HTMLInputElement.prototype, 'value', nextValue, input);
      input.setSelectionRange(caret + 1, caret + 1);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: symbol, inputType: 'insertText' }));
    });
  }
};

const click = (testId: string): void => {
  act(() => {
    screen.getByTestId(testId).click();
  });
};

const waitForEditor = async (): Promise<void> => {
  await screen.findByTestId('listing-save-price');
};

const setWarehouses = (...ids: string[]): void => {
  mockedWarehouses.length = 0;

  for (const [index, id] of ids.entries()) {
    mockedWarehouses.push({ cityName: `Город ${String(index + 1)}`, id, warehouseName: `Склад ${String(index + 1)}` });
  }
};

describe('listing editor', () => {
  afterEach(() => {
    cleanup();
    mockedWarehouses.length = 0;
  });

  it('sends the typed price in kopecks, drops the empty rows at the end and keeps the version of the row of the price', async () => {
    setWarehouses(MOSCOW);
    const server = createServer(createListing(), createPrice([createTier(480000n, 8950n)]));
    renderEditor(server);
    await waitForEditor();

    click('listing-add-tier');
    fireEvent.change(getInput('listing-tier-0-price'), { target: { value: '' } });
    typeText(getInput('listing-tier-0-price'), '95,5');
    click('listing-save-price');

    await waitFor(() => {
      expect(server.savePrice).toHaveBeenCalledTimes(1);
    });
    const request = server.savePrice.mock.calls[0]?.[0];
    expect(request).toMatchObject({ expectedVersion: 2n, listingId: LISTING_ID });
    expect(request?.tiers).toHaveLength(1);
    expect(request?.tiers[0]).toMatchObject({ minQuantity: 480000n, price: { amountMinor: 9550n, currencyCode: RUB } });
  });

  it('shows an error on the fields of an empty row in the middle and sends nothing', async () => {
    setWarehouses(MOSCOW);
    const server = createServer(createListing(), createPrice([createTier(480000n, 8950n)]));
    renderEditor(server);
    await waitForEditor();

    click('listing-add-tier');
    click('listing-add-tier');
    typeText(getInput('listing-tier-2-min'), '900');
    typeText(getInput('listing-tier-2-price'), '80');
    click('listing-save-price');

    await waitFor(() => {
      expect(getInput('listing-tier-1-min').getAttribute('aria-invalid')).toBe('true');
    });
    expect(getInput('listing-tier-1-price').getAttribute('aria-invalid')).toBe('true');
    expect(getInput('listing-tier-0-price').getAttribute('aria-invalid')).toBeNull();
    expect(getInput('listing-tier-2-price').getAttribute('aria-invalid')).toBeNull();
    expect(server.savePrice).not.toHaveBeenCalled();
  });

  it('puts the error of the server of the second tier under the second row after the first one is removed', async () => {
    setWarehouses(MOSCOW);
    const server = createServer(
      createListing(),
      createPrice([createTier(1000n, 9000n), createTier(5000n, 8000n), createTier(9000n, 7000n)]),
    );
    server.savePrice.mockImplementation(() => {
      throw createValidationError([['tiers[1].price.amount_minor', 'catalog.tier_price_order']]);
    });
    renderEditor(server);
    await waitForEditor();

    click('listing-tier-0-remove');

    expect(getInput('listing-tier-0-price').value).toBe('80,00');
    expect(screen.queryByTestId('listing-tier-2')).toBeNull();

    click('listing-save-price');

    await waitFor(() => {
      expect(getInput('listing-tier-1-price').getAttribute('aria-invalid')).toBe('true');
    });
    expect(screen.getByText('Цена должна быть ниже, чем в предыдущей ступени')).toBeTruthy();
    expect(getInput('listing-tier-0-price').getAttribute('aria-invalid')).toBeNull();
  });

  it('sends only the warehouses with a status and puts the error of the server under the right warehouse', async () => {
    setWarehouses(MOSCOW, KAZAN, TVER);
    const server = createServer(
      createListing([
        { quantity: 0n, status: AvailabilityStatus.LOW, warehouseId: KAZAN },
        { quantity: 900000n, status: AvailabilityStatus.IN_STOCK, warehouseId: TVER },
      ]),
      undefined,
    );
    server.saveListing.mockImplementation(() => {
      throw createValidationError([['availability[0].quantity', 'catalog.availability_quantity_required']]);
    });
    renderEditor(server);
    await screen.findByTestId('listing-save');

    expect(getSelect(`listing-warehouse-${MOSCOW}-status`).value).toBe('0');
    expect(getInput(`listing-warehouse-${MOSCOW}-quantity`).readOnly).toBe(true);

    click('listing-save');

    await waitFor(() => {
      expect(server.saveListing).toHaveBeenCalledTimes(1);
    });
    expect(server.saveListing.mock.calls[0]?.[0].availability).toEqual([
      expect.objectContaining({ quantity: 0n, status: AvailabilityStatus.LOW, warehouseId: KAZAN }),
      expect.objectContaining({ quantity: 900000n, status: AvailabilityStatus.IN_STOCK, warehouseId: TVER }),
    ]);
    await waitFor(() => {
      expect(getInput(`listing-warehouse-${KAZAN}-quantity`).getAttribute('aria-invalid')).toBe('true');
    });
    expect(screen.getByText('Для этого статуса нужен остаток больше нуля')).toBeTruthy();
    expect(getInput(`listing-warehouse-${TVER}-quantity`).getAttribute('aria-invalid')).toBeNull();
    expect(getInput(`listing-warehouse-${MOSCOW}-quantity`).getAttribute('aria-invalid')).toBeNull();
  });

  it('keeps the unit read-only with the reason while a price holds it', async () => {
    setWarehouses(MOSCOW);
    const server = createServer(createListing(), createPrice([createTier(480000n, 8950n)]));
    renderEditor(server);
    await waitForEditor();

    expect(getInput('listing-unit-name').readOnly).toBe(true);
    expect(getInput('listing-unit-base').readOnly).toBe(true);
    expect(screen.getByTestId('listing-unit-locked-reason').textContent).toContain('Единица закреплена: по ней уже считается цена');

    click('listing-save');

    await waitFor(() => {
      expect(server.saveListing).toHaveBeenCalledTimes(1);
    });
    expect(server.saveListing.mock.calls[0]?.[0].priceUnit).toMatchObject({ baseQuantity: 1000n, name: 'кг' });
  });

  it('lets the unit be changed while there is no price', async () => {
    setWarehouses(MOSCOW);
    const server = createServer(createListing(), undefined);
    renderEditor(server);
    await screen.findByTestId('listing-save');

    expect(getInput('listing-unit-name').readOnly).toBe(false);
    expect(screen.queryByTestId('listing-unit-locked-reason')).toBeNull();
  });

  it('shows the text of the rule when the publication is refused', async () => {
    setWarehouses(MOSCOW);
    const server = createServer(createListing(), undefined);
    server.publish.mockImplementation(() => {
      throw createValidationError([['', 'catalog.listing_price_required']]);
    });
    renderEditor(server);
    await screen.findByTestId('listing-publish');

    click('listing-publish');

    expect(await screen.findByText('Чтобы опубликовать позицию, сохраните цену')).toBeTruthy();
    expect(server.publish.mock.calls[0]?.[0]).toMatchObject({ expectedVersion: 4n, isPublished: true, listingId: LISTING_ID });
  });

  it('offers to reload the position after a conflict of versions', async () => {
    setWarehouses(MOSCOW);
    const server = createServer(createListing(), undefined);
    server.saveListing.mockImplementation(() => {
      throw createVersionConflict();
    });
    renderEditor(server);
    await screen.findByTestId('listing-save');

    click('listing-save');

    expect(await screen.findByTestId('listing-reload')).toBeTruthy();
    expect(screen.getByText('Пока вы смотрели, данные обновились')).toBeTruthy();
  });
});
