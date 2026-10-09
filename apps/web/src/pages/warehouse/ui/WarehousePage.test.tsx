import type {
  ListWarehousesResponse,
  Organization,
} from '@skladburg/contracts/organization/v1/organization';
import type { QueryClient } from '@tanstack/react-query';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import {
  GetOrganizationResponseSchema,
  ListWarehousesResponseSchema,
  OrganizationSchema,
  OrganizationService,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { ObjectRefValue } from '@/shared/routing';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import {
  OBJECT_TYPES,
  RoutingProvider,
} from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';

import { warehouseKeys } from '../api/warehouseKeys';
import { WarehousePage } from './WarehousePage';

const FOCUSED_OBJECT_ID = 'f6000001-0000-4000-8000-000000000000';
const ORGANIZATION_NAME = 'Север-Опт';
const LEGAL_NAME = 'ООО «Север-Опт»';
const ORGANIZATION_INN = '7700000001';
const FIRST_WAREHOUSE = { address: 'г. Северск, ул. Складская, 1', id: 'f5000001-0000-4000-8000-000000000000', name: 'Склад «Север»' };
const SECOND_WAREHOUSE = { address: 'г. Северск, ул. Заводская, 7', id: 'f5000002-0000-4000-8000-000000000000', name: 'Склад «Юг»' };

interface DeferredValue {
  promise: Promise<void>;
  reject: (reason: Error) => void;
  resolve: () => void;
}
type OrganizationHandler = () => Promise<ReturnType<typeof createOrganizationResponse>> | ReturnType<typeof createOrganizationResponse>;
interface RenderedPageValue {
  queryClient: QueryClient;
}

interface RenderPageOptionsValue {
  focus?: ObjectRefValue | undefined;
  getOrganization?: OrganizationHandler | undefined;
  listWarehouses?: undefined | WarehousesHandler;
}

type WarehouseFixtureValue = typeof FIRST_WAREHOUSE;

type WarehousesHandler = () => ListWarehousesResponse | Promise<ListWarehousesResponse>;

const createOrganization = (): Organization => create(OrganizationSchema, {
  id: TEST_ORGANIZATION_ID,
  inn: ORGANIZATION_INN,
  legalName: LEGAL_NAME,
  name: ORGANIZATION_NAME,
});

const createOrganizationResponse = (): ReturnType<typeof create<typeof GetOrganizationResponseSchema>> => create(
  GetOrganizationResponseSchema,
  { organization: createOrganization() },
);

const createWarehousesResponse = (warehouses: readonly WarehouseFixtureValue[]): ListWarehousesResponse => create(
  ListWarehousesResponseSchema,
  { warehouses: warehouses.map(warehouse => create(WarehouseSchema, warehouse)) },
);

const createCodedError = (): ConnectError => new ConnectError(
  'conflict',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code: ErrorCode.INVALID_TRANSITION }) }],
);

const createDeferred = (): DeferredValue => {
  let resolve: () => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
};

const renderPage = (options: RenderPageOptionsValue = {}): RenderedPageValue => {
  const { focus } = options;
  const location = createMemoryLocation('/warehouse');
  const queryClient = createQueryClient({ networkMode: 'always' });
  const runtime = createTestRuntime({
    routes: router => router.service(OrganizationService, {
      getOrganization: options.getOrganization ?? createOrganizationResponse,
      listWarehouses: options.listWarehouses ?? (() => createWarehousesResponse([FIRST_WAREHOUSE, SECOND_WAREHOUSE])),
    }),
  });

  render(
    withTestLocalizer(
      <RoutingProvider location={location}>
        <ApiRuntimeProvider runtime={runtime}>
          <QueryClientProvider client={queryClient}>
            <WarehousePage focus={focus} />
          </QueryClientProvider>
        </ApiRuntimeProvider>
      </RoutingProvider>,
    ),
  );

  return { queryClient };
};

const formatAddress = (address: string): string => defaultLocaleCatalog['warehouse.warehouses.address'].replace('{address}', address);

const getWarehouseSection = (): HTMLElement => screen.getByRole('region', { name: defaultLocaleCatalog['warehouse.warehouses.title'] });

describe('WarehousePage header', () => {
  afterEach(() => {
    cleanup();
  });

  it('names the section with the only first level heading that only screen readers see', () => {
    renderPage();

    const titles = screen.getAllByRole('heading', { level: 1 });

    expect(titles).toHaveLength(1);
    expect(titles[0]?.textContent).toBe(defaultLocaleCatalog['section.warehouse.title']);
    expect(titles[0]?.className).toContain('sr-only');
  });

  it('does not render a landmark of its own', () => {
    renderPage();

    expect(screen.queryByRole('main')).toBeNull();
  });
});

describe('WarehousePage zones', () => {
  let viewport: IFakeViewport;

  beforeEach(() => {
    viewport = installFakeViewport('desktop');
  });

  afterEach(() => {
    cleanup();
    viewport.restore();
  });

  it('keeps the note about the future world in the scene', () => {
    renderPage();

    expect(within(screen.getByTestId('hud-zone-scene')).getByText(defaultLocaleCatalog['warehouse.placeholder'])).toBeDefined();
  });

  it.each(['scene', 'lists', 'inspector'])('draws the %s zone on a desktop', (zone) => {
    renderPage();

    expect(screen.getByTestId(`hud-zone-${zone}`)).toBeDefined();
  });

  it.each(['kpi', 'tracker', 'panel'])('draws no %s zone', (zone) => {
    renderPage();

    expect(screen.queryByTestId(`hud-zone-${zone}`)).toBeNull();
  });

  it('puts the organization card above the warehouse tab in the lists zone', async () => {
    renderPage();

    const lists = screen.getByTestId('hud-zone-lists');
    const card = await within(lists).findByRole('region', { name: defaultLocaleCatalog['warehouse.organization.title'] });
    const tablist = within(lists).getByRole('tablist', { name: defaultLocaleCatalog['hud.lists.label'] });

    expect(card.compareDocumentPosition(tablist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(tablist).getAllByRole('tab')).toHaveLength(1);
  });

  it('counts the warehouses in the name of the tab once they are loaded', async () => {
    const response = createDeferred();
    renderPage({
      listWarehouses: async () => {
        await response.promise;

        return createWarehousesResponse([FIRST_WAREHOUSE, SECOND_WAREHOUSE]);
      },
    });

    expect(screen.getByRole('tab').textContent).toBe(defaultLocaleCatalog['hud.lists.warehouses']);

    response.resolve();

    expect((await screen.findByRole('tab', { name: `${defaultLocaleCatalog['hud.lists.warehouses']} 2` }))).toBeDefined();
  });

  it('keeps the count of an empty list at zero', async () => {
    renderPage({ listWarehouses: () => createWarehousesResponse([]) });

    expect((await screen.findByRole('tab', { name: `${defaultLocaleCatalog['hud.lists.warehouses']} 0` }))).toBeDefined();
  });

  it('shows the lists as the main zone on a phone', async () => {
    viewport.setViewportClass('phone');
    renderPage();

    expect(screen.getByTestId('hud-zone-lists')).toBeDefined();
    expect(await screen.findByText(FIRST_WAREHOUSE.name)).toBeDefined();
  });
});

describe('WarehousePage focused object', () => {
  let viewport: IFakeViewport;

  beforeEach(() => {
    viewport = installFakeViewport('desktop');
  });

  afterEach(() => {
    cleanup();
    viewport.restore();
  });

  it('shows the empty inspector when there is no object in the address', () => {
    renderPage();

    expect(within(screen.getByTestId('hud-zone-inspector')).getByText(defaultLocaleCatalog['hud.inspector.empty'])).toBeDefined();
    expect(screen.queryByText(FOCUSED_OBJECT_ID)).toBeNull();
  });

  it.each(OBJECT_TYPES)('names the opened object of the type %s in the inspector and keeps its identifier out of translation', (type) => {
    renderPage({ focus: { id: FOCUSED_OBJECT_ID, type } });

    const identifier = within(screen.getByTestId('hud-zone-inspector')).getByText(FOCUSED_OBJECT_ID);
    const typeTitle = defaultLocaleCatalog[`object.type.${type}`];

    expect(identifier.getAttribute('translate')).toBe('no');
    expect(identifier.closest('p')?.textContent)
      .toBe(`${defaultLocaleCatalog['hud.inspector.object'].replace('{type}', typeTitle)} ${FOCUSED_OBJECT_ID}`);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(defaultLocaleCatalog['section.warehouse.title']);
  });

  it('opens the object in the sheet on a phone', () => {
    viewport.setViewportClass('phone');
    renderPage({ focus: { id: FOCUSED_OBJECT_ID, type: 'warehouse' } });

    expect(within(screen.getByTestId('hud-inspector-sheet')).getByText(FOCUSED_OBJECT_ID)).toBeDefined();
  });
});

describe('WarehousePage organization card', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the name and the legal name but not the tax number', async () => {
    renderPage();

    const card = await screen.findByRole('region', { name: defaultLocaleCatalog['warehouse.organization.title'] });

    expect(within(card).getByRole('heading', { level: 2 }).textContent).toBe(ORGANIZATION_NAME);
    expect(within(card).getByText(LEGAL_NAME)).toBeDefined();
    expect(screen.queryByText(new RegExp(ORGANIZATION_INN))).toBeNull();
  });

  it('shows an empty busy frame while the organization is loading', async () => {
    const response = createDeferred();
    renderPage({
      getOrganization: async () => {
        await response.promise;

        return createOrganizationResponse();
      },
    });

    const frame = screen.getByRole('status', { name: defaultLocaleCatalog['warehouse.organization.loading'] });

    expect(frame.getAttribute('aria-busy')).toBe('true');
    expect(frame.textContent).toBe('');
    expect(screen.queryByText(LEGAL_NAME)).toBeNull();

    response.resolve();

    expect(await screen.findByText(LEGAL_NAME)).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps the frame in the shape of the card', async () => {
    const response = createDeferred();
    renderPage({
      getOrganization: async () => {
        await response.promise;

        return createOrganizationResponse();
      },
    });

    const frame = screen.getByRole('status', { name: defaultLocaleCatalog['warehouse.organization.loading'] });
    const frameCard = frame.firstElementChild;
    const frameLines = Array.from(frameCard?.children ?? []);

    expect(frameLines).toHaveLength(2);
    expect(frameLines.every(line => line.getAttribute('aria-hidden') === 'true')).toBe(true);

    response.resolve();

    const section = await screen.findByRole('region', { name: defaultLocaleCatalog['warehouse.organization.title'] });
    const card = section.firstElementChild;

    expect(frameCard?.className).toBe(card?.className);
    expect(card?.children).toHaveLength(frameLines.length);
  });

  it('shows the error by code and loads the organization on retry', async () => {
    let isFailing = true;
    const getOrganization = vi.fn(() => {
      if (isFailing) {
        return Promise.reject(createCodedError());
      }

      return createOrganizationResponse();
    });
    renderPage({ getOrganization });

    const alert = await screen.findByText(defaultLocaleCatalog['error.invalid_transition']);

    expect(alert.getAttribute('role')).toBe('alert');
    expect(screen.queryByRole('status')).toBeNull();

    isFailing = false;
    fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    expect(await screen.findByText(LEGAL_NAME)).toBeDefined();
    expect(getOrganization).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(defaultLocaleCatalog['error.invalid_transition'])).toBeNull();
  });

  it('keeps the error and the focused retry button busy while the organization is requested again after a failure', async () => {
    let attempt = 0;
    const retryResponse = createDeferred();
    renderPage({
      getOrganization: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw createCodedError();
        }
        await retryResponse.promise;

        return createOrganizationResponse();
      },
    });

    const alert = await screen.findByText(defaultLocaleCatalog['error.invalid_transition']);
    const retryButton = screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] });
    retryButton.focus();
    fireEvent.click(retryButton);

    const busyButton = await screen.findByRole('button', { name: defaultLocaleCatalog['common.retrying'] });

    expect(busyButton).toBe(retryButton);
    expect(busyButton.getAttribute('aria-busy')).toBe('true');
    expect(busyButton.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(retryButton);
    expect(alert.isConnected).toBe(true);
    expect(screen.queryByRole('status', { name: defaultLocaleCatalog['warehouse.organization.loading'] })).toBeNull();

    retryResponse.resolve();

    expect(await screen.findByText(LEGAL_NAME)).toBeDefined();
    expect(screen.queryByText(defaultLocaleCatalog['error.invalid_transition'])).toBeNull();
  });
});

describe('WarehousePage warehouse list', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the name and the address of every warehouse', async () => {
    renderPage();
    await screen.findByText(FIRST_WAREHOUSE.name);

    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');

    expect(items.map(item => item.textContent)).toEqual([
      `${FIRST_WAREHOUSE.name}${formatAddress(FIRST_WAREHOUSE.address)}`,
      `${SECOND_WAREHOUSE.name}${formatAddress(SECOND_WAREHOUSE.address)}`,
    ]);
    expect(list.getAttribute('aria-busy')).toBeNull();
  });

  it('does not show the address line for a warehouse without an address', async () => {
    const warehouseWithoutAddress = { ...FIRST_WAREHOUSE, address: '' };
    renderPage({ listWarehouses: () => createWarehousesResponse([warehouseWithoutAddress]) });

    const nameElement = await screen.findByText(warehouseWithoutAddress.name);
    const item = within(screen.getByRole('list')).getByRole('listitem');

    expect(nameElement).toBeDefined();
    expect(item.textContent).toBe(warehouseWithoutAddress.name);
    expect(item.querySelectorAll('p')).toHaveLength(1);
  });

  it('shows three empty frames without text while the warehouses are loading', async () => {
    const response = createDeferred();
    renderPage({
      listWarehouses: async () => {
        await response.promise;

        return createWarehousesResponse([FIRST_WAREHOUSE]);
      },
    });

    const frame = screen.getByRole('status', { name: defaultLocaleCatalog['warehouse.warehouses.loading'] });

    expect(frame.getAttribute('aria-busy')).toBe('true');
    expect(frame.firstElementChild?.children).toHaveLength(3);
    expect(frame.textContent).toBe('');
    expect(screen.queryByRole('list')).toBeNull();
    expect(within(getWarehouseSection()).getByRole('heading', { level: 2 }).textContent)
      .toBe(defaultLocaleCatalog['warehouse.warehouses.title']);

    response.resolve();

    expect(await screen.findByText(FIRST_WAREHOUSE.name)).toBeDefined();
    expect(screen.queryByRole('status', { name: defaultLocaleCatalog['warehouse.warehouses.loading'] })).toBeNull();
  });

  it('keeps every frame in the shape of the warehouse card', async () => {
    const response = createDeferred();
    renderPage({
      listWarehouses: async () => {
        await response.promise;

        return createWarehousesResponse([FIRST_WAREHOUSE]);
      },
    });

    const frame = screen.getByRole('status', { name: defaultLocaleCatalog['warehouse.warehouses.loading'] });
    const frameCards = Array.from(frame.firstElementChild?.children ?? []);

    const areLinesHidden = frameCards.every((frameCard) => {
      return Array.from(frameCard.children).every(line => line.getAttribute('aria-hidden') === 'true');
    });

    expect(areLinesHidden).toBe(true);

    response.resolve();

    await screen.findByText(FIRST_WAREHOUSE.name);

    const card = within(screen.getByRole('list')).getByRole('listitem').firstElementChild;

    expect(frameCards.map(frameCard => frameCard.className)).toEqual(frameCards.map(() => card?.className));
    expect(frameCards.map(frameCard => frameCard.children.length)).toEqual(frameCards.map(() => card?.children.length));
  });

  it('shows the hint when there are no warehouses', async () => {
    renderPage({ listWarehouses: () => createWarehousesResponse([]) });

    expect(await screen.findByText(defaultLocaleCatalog['warehouse.warehouses.empty'])).toBeDefined();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('shows the error by code and requests the list again on retry', async () => {
    let isFailing = true;
    const listWarehouses = vi.fn(() => {
      if (isFailing) {
        return Promise.reject(createCodedError());
      }

      return createWarehousesResponse([FIRST_WAREHOUSE]);
    });
    renderPage({ listWarehouses });

    const alert = await within(getWarehouseSection()).findByRole('alert');

    expect(alert.textContent).toBe(defaultLocaleCatalog['error.invalid_transition']);
    expect(within(getWarehouseSection()).queryByRole('list')).toBeNull();

    isFailing = false;
    fireEvent.click(within(getWarehouseSection()).getByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    expect(await screen.findByText(FIRST_WAREHOUSE.name)).toBeDefined();
    expect(listWarehouses).toHaveBeenCalledTimes(2);
    expect(within(getWarehouseSection()).queryByRole('alert')).toBeNull();
  });

  it('keeps the error and the focused retry button busy while the list is requested again after a failure', async () => {
    let attempt = 0;
    const retryResponse = createDeferred();
    renderPage({
      listWarehouses: async () => {
        attempt += 1;
        if (attempt === 1) {
          throw createCodedError();
        }
        await retryResponse.promise;

        return createWarehousesResponse([FIRST_WAREHOUSE]);
      },
    });

    await within(getWarehouseSection()).findByRole('alert');
    const retryButton = within(getWarehouseSection()).getByRole('button', { name: defaultLocaleCatalog['common.retry'] });
    retryButton.focus();
    fireEvent.click(retryButton);

    const busyButton = await within(getWarehouseSection()).findByRole('button', { name: defaultLocaleCatalog['common.retrying'] });

    expect(busyButton).toBe(retryButton);
    expect(busyButton.getAttribute('aria-busy')).toBe('true');
    expect(busyButton.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(retryButton);
    expect(within(getWarehouseSection()).getByRole('alert').textContent).toBe(defaultLocaleCatalog['error.invalid_transition']);
    expect(screen.queryByRole('status', { name: defaultLocaleCatalog['warehouse.warehouses.loading'] })).toBeNull();

    fireEvent.click(busyButton);

    expect(attempt).toBe(2);

    retryResponse.resolve();

    expect(await screen.findByText(FIRST_WAREHOUSE.name)).toBeDefined();
    expect(within(getWarehouseSection()).queryByRole('alert')).toBeNull();
  });

  it('stores the list under the organization key and declares the organization channel', async () => {
    const { queryClient } = renderPage();

    await screen.findByText(FIRST_WAREHOUSE.name);

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: warehouseKeys.list(TEST_ORGANIZATION_ID) });

    expect(query?.meta).toEqual({ channels: [`org:${TEST_ORGANIZATION_ID}`] });
    expect(query?.state.data).toHaveLength(2);
  });
});
