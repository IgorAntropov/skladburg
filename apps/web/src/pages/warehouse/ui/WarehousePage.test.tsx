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
  waitFor,
  within,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { IDemoControl } from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';
import type { ObjectRefValue } from '@/shared/routing';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';
import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import { OBJECT_TYPES } from '@/shared/routing';

import { warehouseKeys } from '../api/warehouseKeys';
import { createSkeletonLineClassName } from './cardStyles';
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
  demoControl?: IDemoControl | undefined;
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

const createDemoControl = (reset: IDemoControl['reset']): IDemoControl => ({
  listPersonas: () => Promise.resolve([]),
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset,
});

const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

const renderPage = async (options: RenderPageOptionsValue = {}): Promise<RenderedPageValue> => {
  const { focus } = options;
  const localizer = await createTestLocalizer();
  const queryClient = createQueryClient({ networkMode: 'always' });
  const runtime = createTestRuntime({
    demoControl: options.demoControl,
    routes: router => router.service(OrganizationService, {
      getOrganization: options.getOrganization ?? createOrganizationResponse,
      listWarehouses: options.listWarehouses ?? (() => createWarehousesResponse([FIRST_WAREHOUSE, SECOND_WAREHOUSE])),
    }),
  });

  render(
    <LocalizerProvider localizer={localizer}>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>
          <WarehousePage focus={focus} />
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </LocalizerProvider>,
  );

  return { queryClient };
};

const formatAddress = (address: string): string => defaultLocaleCatalog['warehouse.warehouses.address'].replace('{address}', address);

const getWarehouseSection = (): HTMLElement => screen.getByRole('region', { name: defaultLocaleCatalog['warehouse.warehouses.title'] });

const getClassNames = (elements: Iterable<Element>): string[] => Array.from(elements, element => element.className);

const getResetButton = (name: string): HTMLElement => screen.getByRole('button', { name });

describe('WarehousePage header', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the title of the section as the only first level heading', async () => {
    await renderPage();

    const titles = screen.getAllByRole('heading', { level: 1 });

    expect(titles).toHaveLength(1);
    expect(titles[0]?.textContent).toBe(defaultLocaleCatalog['section.warehouse.title']);
  });

  it('keeps the note about the future world', async () => {
    await renderPage();

    expect(screen.getByText(defaultLocaleCatalog['warehouse.placeholder'])).toBeDefined();
  });
});

describe('WarehousePage focused object', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not name an object when there is none in the address', async () => {
    await renderPage();

    expect(screen.queryByText(FOCUSED_OBJECT_ID)).toBeNull();
  });

  it('does not render a landmark of its own', async () => {
    await renderPage();

    expect(screen.queryByRole('main')).toBeNull();
  });

  it.each(OBJECT_TYPES)('names the opened object of the type %s and keeps its identifier out of translation', async (type) => {
    await renderPage({ focus: { id: FOCUSED_OBJECT_ID, type } });

    const identifier = screen.getByText(FOCUSED_OBJECT_ID);
    const focusedText = defaultLocaleCatalog['routing.focusedObject'];

    expect(identifier.getAttribute('translate')).toBe('no');
    const typeTitle = defaultLocaleCatalog[`object.type.${type}`];

    expect(identifier.closest('p')?.textContent).toBe(`${focusedText.replace('{type}', typeTitle)} ${FOCUSED_OBJECT_ID}`);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(defaultLocaleCatalog['section.warehouse.title']);
  });
});

describe('WarehousePage organization card', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the name and the legal name but not the tax number', async () => {
    await renderPage();

    const card = await screen.findByRole('region', { name: defaultLocaleCatalog['warehouse.organization.title'] });

    expect(within(card).getByRole('heading', { level: 2 }).textContent).toBe(ORGANIZATION_NAME);
    expect(within(card).getByText(LEGAL_NAME)).toBeDefined();
    expect(screen.queryByText(new RegExp(ORGANIZATION_INN))).toBeNull();
  });

  it('shows an empty busy frame while the organization is loading', async () => {
    const response = createDeferred();
    await renderPage({
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

  it('keeps the lines of the frame in step with the lines of the card', async () => {
    const response = createDeferred();
    await renderPage({
      getOrganization: async () => {
        await response.promise;

        return createOrganizationResponse();
      },
    });

    const frame = screen.getByRole('status', { name: defaultLocaleCatalog['warehouse.organization.loading'] });
    const frameClassName = frame.className;
    const frameLines = Array.from(frame.children);

    expect(frameLines.every(line => line.getAttribute('aria-hidden') === 'true')).toBe(true);

    response.resolve();

    const card = await screen.findByRole('region', { name: defaultLocaleCatalog['warehouse.organization.title'] });
    const cardLines = Array.from(card.children);

    expect(getClassNames(frameLines)).toEqual(getClassNames(cardLines).map(createSkeletonLineClassName));
    expect(frameClassName.replace(' border-dashed', '')).toBe(card.className);
  });

  it('shows the error by code and loads the organization on retry', async () => {
    let isFailing = true;
    const getOrganization = vi.fn(() => {
      if (isFailing) {
        return Promise.reject(createCodedError());
      }

      return createOrganizationResponse();
    });
    await renderPage({ getOrganization });

    const alert = await screen.findByText(defaultLocaleCatalog['error.invalid_transition']);

    expect(alert.getAttribute('role')).toBe('alert');
    expect(screen.queryByRole('status')).toBeNull();

    isFailing = false;
    fireEvent.click(screen.getByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    expect(await screen.findByText(LEGAL_NAME)).toBeDefined();
    expect(getOrganization).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(defaultLocaleCatalog['error.invalid_transition'])).toBeNull();
  });
});

describe('WarehousePage warehouse list', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the name and the address of every warehouse', async () => {
    await renderPage();
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
    await renderPage({ listWarehouses: () => createWarehousesResponse([warehouseWithoutAddress]) });

    const nameElement = await screen.findByText(warehouseWithoutAddress.name);
    const item = within(screen.getByRole('list')).getByRole('listitem');

    expect(nameElement).toBeDefined();
    expect(item.textContent).toBe(warehouseWithoutAddress.name);
    expect(item.querySelectorAll('p')).toHaveLength(1);
  });

  it('shows three empty frames without text while the warehouses are loading', async () => {
    const response = createDeferred();
    await renderPage({
      listWarehouses: async () => {
        await response.promise;

        return createWarehousesResponse([FIRST_WAREHOUSE]);
      },
    });

    const list = screen.getByRole('list', { name: defaultLocaleCatalog['warehouse.warehouses.loading'] });

    expect(list.getAttribute('aria-busy')).toBe('true');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(list.textContent).toBe('');
    expect(within(getWarehouseSection()).getByRole('heading', { level: 2 }).textContent)
      .toBe(defaultLocaleCatalog['warehouse.warehouses.title']);

    response.resolve();

    expect(await screen.findByText(FIRST_WAREHOUSE.name)).toBeDefined();
    expect(screen.queryByRole('list', { name: defaultLocaleCatalog['warehouse.warehouses.loading'] })).toBeNull();
  });

  it('keeps the lines of every frame in step with the lines of the warehouse card', async () => {
    const response = createDeferred();
    await renderPage({
      listWarehouses: async () => {
        await response.promise;

        return createWarehousesResponse([FIRST_WAREHOUSE]);
      },
    });

    const list = screen.getByRole('list', { name: defaultLocaleCatalog['warehouse.warehouses.loading'] });
    const frameItems = within(list).getAllByRole('listitem');
    const frameLineClassNames = frameItems.map(item => getClassNames(Array.from(item.children)));
    const frameItemClassName = frameItems[0]?.className;

    expect(frameItems.every(item => Array.from(item.children).every(line => line.getAttribute('aria-hidden') === 'true'))).toBe(true);

    response.resolve();

    const nameElement = await screen.findByText(FIRST_WAREHOUSE.name);
    const cardItem = within(screen.getByRole('list')).getByRole('listitem');
    const expectedLineClassNames = getClassNames(Array.from(cardItem.children)).map(createSkeletonLineClassName);

    expect(nameElement).toBeDefined();
    expect(expectedLineClassNames).toHaveLength(2);
    expect(frameLineClassNames).toEqual(frameItems.map(() => expectedLineClassNames));
    expect(frameItemClassName?.replace(' border-dashed', '')).toBe(cardItem.className);
  });

  it('shows the hint when there are no warehouses', async () => {
    await renderPage({ listWarehouses: () => createWarehousesResponse([]) });

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
    await renderPage({ listWarehouses });

    const alert = await within(getWarehouseSection()).findByRole('alert');

    expect(alert.textContent).toBe(defaultLocaleCatalog['error.invalid_transition']);
    expect(within(getWarehouseSection()).queryByRole('list')).toBeNull();

    isFailing = false;
    fireEvent.click(within(getWarehouseSection()).getByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    expect(await screen.findByText(FIRST_WAREHOUSE.name)).toBeDefined();
    expect(listWarehouses).toHaveBeenCalledTimes(2);
    expect(within(getWarehouseSection()).queryByRole('alert')).toBeNull();
  });

  it('shows the empty frames again while the list is requested after a failure', async () => {
    let attempt = 0;
    const retryResponse = createDeferred();
    await renderPage({
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
    fireEvent.click(within(getWarehouseSection()).getByRole('button', { name: defaultLocaleCatalog['common.retry'] }));

    const list = await screen.findByRole('list', { name: defaultLocaleCatalog['warehouse.warehouses.loading'] });

    expect(list.getAttribute('aria-busy')).toBe('true');
    expect(within(getWarehouseSection()).queryByRole('alert')).toBeNull();

    retryResponse.resolve();

    expect(await screen.findByText(FIRST_WAREHOUSE.name)).toBeDefined();
  });

  it('stores the list under the organization key and declares the organization channel', async () => {
    const { queryClient } = await renderPage();

    await screen.findByText(FIRST_WAREHOUSE.name);

    const query = queryClient.getQueryCache().find({ exact: true, queryKey: warehouseKeys.list(TEST_ORGANIZATION_ID) });

    expect(query?.meta).toEqual({ channels: [`org:${TEST_ORGANIZATION_ID}`] });
    expect(query?.state.data).toHaveLength(2);
  });
});

describe('WarehousePage demo reset', () => {
  afterEach(() => {
    cleanup();
  });

  it('has no reset button without the demo control', async () => {
    await renderPage({ demoControl: undefined });

    await screen.findByText(FIRST_WAREHOUSE.name);

    expect(screen.queryByRole('button', { name: defaultLocaleCatalog['warehouse.resetDemo.label'] })).toBeNull();
  });

  it('shows the progress while the command runs and calls reset once per click', async () => {
    const response = createDeferred();
    const reset = vi.fn(() => response.promise);
    await renderPage({ demoControl: createDemoControl(reset) });

    await screen.findByText(FIRST_WAREHOUSE.name);
    fireEvent.click(getResetButton(defaultLocaleCatalog['warehouse.resetDemo.label']));

    const pendingButton = await screen.findByRole('button', { name: defaultLocaleCatalog['warehouse.resetDemo.pending'] });

    expect(pendingButton.hasAttribute('disabled')).toBe(true);
    expect(pendingButton.getAttribute('aria-busy')).toBe('true');

    fireEvent.click(pendingButton);

    expect(reset).toHaveBeenCalledTimes(1);

    response.resolve();

    const idleButton = await screen.findByRole('button', { name: defaultLocaleCatalog['warehouse.resetDemo.label'] });

    expect(idleButton.hasAttribute('disabled')).toBe(false);
    expect(idleButton.getAttribute('aria-busy')).toBe('false');
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('does not change the data before the answer and does not refetch by itself', async () => {
    const response = createDeferred();
    const listWarehouses = vi.fn(() => createWarehousesResponse([FIRST_WAREHOUSE, SECOND_WAREHOUSE]));
    await renderPage({ demoControl: createDemoControl(() => response.promise), listWarehouses });

    await screen.findByText(FIRST_WAREHOUSE.name);
    fireEvent.click(getResetButton(defaultLocaleCatalog['warehouse.resetDemo.label']));
    await screen.findByRole('button', { name: defaultLocaleCatalog['warehouse.resetDemo.pending'] });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(FIRST_WAREHOUSE.name)).toBeDefined();

    response.resolve();
    await screen.findByRole('button', { name: defaultLocaleCatalog['warehouse.resetDemo.label'] });

    expect(listWarehouses).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows the error by code and allows trying again', async () => {
    let isFailing = true;
    const reset = vi.fn(() => (isFailing ? Promise.reject(createCodedError()) : Promise.resolve()));
    await renderPage({ demoControl: createDemoControl(reset) });

    await screen.findByText(FIRST_WAREHOUSE.name);
    fireEvent.click(getResetButton(defaultLocaleCatalog['warehouse.resetDemo.label']));

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe(defaultLocaleCatalog['error.invalid_transition']);
    expect(getResetButton(defaultLocaleCatalog['warehouse.resetDemo.label']).hasAttribute('disabled')).toBe(false);

    isFailing = false;
    fireEvent.click(getResetButton(defaultLocaleCatalog['warehouse.resetDemo.label']));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });

    expect(reset).toHaveBeenCalledTimes(2);
  });
});
