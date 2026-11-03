import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import {
  Code,
  ConnectError,
} from '@connectrpc/connect';
import {
  AccessService,
  EffectivePermissionSchema,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  CatalogService,
  ListingSchema,
  type ListOwnListingsRequest,
  type ListOwnListingsResponse,
  ListOwnListingsResponseSchema,
  OwnListingSchema,
  ProductSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  type ListShowcaseListingsRequest,
  type ListShowcaseListingsResponse,
  ListShowcaseListingsResponseSchema,
  ShowcaseListingSchema,
  ShowcaseService,
  ShowcaseSupplierSchema,
} from '@skladburg/contracts/catalog/v1/showcase';
import {
  CitySchema,
  ListCitiesResponseSchema,
  ListMapNodesResponseSchema,
  type ListMapSitesRequest,
  type ListMapSitesResponse,
  ListMapSitesResponseSchema,
  ListRouteLegsResponseSchema,
  MapNodeSchema,
  MapSiteSchema,
  NetworkService,
} from '@skladburg/contracts/network/v1/network';
import {
  GetOrganizationResponseSchema,
  type ListWarehousesRequest,
  type ListWarehousesResponse,
  ListWarehousesResponseSchema,
  OrganizationProfileSchema,
  OrganizationSchema,
  OrganizationService,
  ProfileKind,
  WarehouseSchema,
} from '@skladburg/contracts/organization/v1/organization';
import {
  type ListOrganizationShowcasesRequest,
  type ListOrganizationShowcasesResponse,
  ListOrganizationShowcasesResponseSchema,
  OrganizationShowcaseSchema,
  OrganizationShowcaseService,
} from '@skladburg/contracts/organization/v1/showcase';
import {
  getPermissionName,
  type KnownPermissionCode,
} from '@skladburg/contracts/runtime';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import type { ApiRuntimeValue } from '@/shared/api';

import { organizationKeys } from '@/entities/organization';
import { sessionKeys } from '@/entities/session';
import { ApiRuntimeProvider } from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
  TEST_USER_ID,
} from '@/shared/api/index.testing';

import type { SearchGroupValue } from '../model/searchResultTypes';

import { globalSearchKeys } from './globalSearchKeys';
import { useGlobalSearch } from './useGlobalSearch';

const OTHER_ORGANIZATION_ID = 'f0000003-0000-4000-8000-000000000000';

interface PersonaValue {
  organizationName?: string;
  permissions: readonly KnownPermissionCode[];
  profiles: readonly ProfileKind[];
}

const SUPPLIER: PersonaValue = {
  permissions: [PermissionCode.CATALOG_VIEW, PermissionCode.NETWORK_VIEW],
  profiles: [ProfileKind.SUPPLIER],
};

const CUSTOMER: PersonaValue = {
  permissions: [PermissionCode.MARKETPLACE_VIEW, PermissionCode.NETWORK_VIEW],
  profiles: [ProfileKind.CUSTOMER],
};

const STOREKEEPER: PersonaValue = {
  organizationName: 'Свежий рынок',
  permissions: [PermissionCode.WAREHOUSE_VIEW],
  profiles: [ProfileKind.CUSTOMER],
};

const ACCOUNTANT: PersonaValue = { permissions: [], profiles: [ProfileKind.SUPPLIER] };

interface HandlersValue {
  listMapSites: Mock<(request: ListMapSitesRequest) => ListMapSitesResponse>;
  listOrganizationShowcases: Mock<(request: ListOrganizationShowcasesRequest) => ListOrganizationShowcasesResponse>;
  listOwnListings: Mock<(request: ListOwnListingsRequest) => ListOwnListingsResponse>;
  listShowcaseListings: Mock<(request: ListShowcaseListingsRequest) => ListShowcaseListingsResponse>;
  listWarehouses: Mock<(request: ListWarehousesRequest) => ListWarehousesResponse>;
}

const createOwnListingsResponse = (id: string, name: string): ListOwnListingsResponse => (
  create(ListOwnListingsResponseSchema, {
    listings: [create(OwnListingSchema, {
      listing: create(ListingSchema, { id, isPublished: true }),
      product: create(ProductSchema, { id: `product-${id}`, name }),
    })],
  })
);

const createHandlers = (): HandlersValue => ({
  listMapSites: vi.fn((_request: ListMapSitesRequest): ListMapSitesResponse => create(ListMapSitesResponseSchema, {
    mapSites: [create(MapSiteSchema, {
      cityId: 'city-rostov',
      id: 'site-1',
      mapNodeId: 'node-rostov',
      name: '',
      organizationId: OTHER_ORGANIZATION_ID,
      organizationName: 'Голден Фрут',
      profileKind: ProfileKind.SUPPLIER,
    })],
  })),
  listOrganizationShowcases: vi.fn((_request: ListOrganizationShowcasesRequest) => (
    create(ListOrganizationShowcasesResponseSchema, {
      organizations: [
        create(OrganizationShowcaseSchema, {
          id: 'org-1',
          name: 'Тёплый угол',
          profiles: [create(OrganizationProfileSchema, { kind: ProfileKind.SUPPLIER, verificationLevel: 2 })],
        }),
        create(OrganizationShowcaseSchema, { id: 'org-2', name: 'Голден Фрут' }),
      ],
    })
  )),
  listOwnListings: vi.fn((_request: ListOwnListingsRequest) => createOwnListingsResponse('listing-own-1', 'Яблоки Голден')),
  listShowcaseListings: vi.fn((_request: ListShowcaseListingsRequest) => (
    create(ListShowcaseListingsResponseSchema, {
      listings: [create(ShowcaseListingSchema, {
        id: 'listing-showcase-1',
        productName: 'Яблоки Голден',
        supplier: create(ShowcaseSupplierSchema, { name: 'Голден Фрут' }),
      })],
    })
  )),
  listWarehouses: vi.fn((_request: ListWarehousesRequest): ListWarehousesResponse => create(ListWarehousesResponseSchema, {
    warehouses: [create(WarehouseSchema, { cityId: 'city-rostov', id: 'warehouse-1', name: 'Главный склад' })],
  })),
});

const createRuntime = (persona: PersonaValue, handlers: HandlersValue): ApiRuntimeValue => createTestRuntime({
  routes: (router) => {
    router.service(AccessService, {
      getSession: () => create(GetSessionResponseSchema, {
        permissions: persona.permissions.map(code => create(EffectivePermissionSchema, {
          isOrganizationWide: true,
          permission: getPermissionName(code),
        })),
      }),
    });
    router.service(OrganizationService, {
      getOrganization: () => create(GetOrganizationResponseSchema, {
        organization: create(OrganizationSchema, {
          id: TEST_ORGANIZATION_ID,
          name: persona.organizationName ?? 'Поставщик',
          profiles: persona.profiles.map(kind => create(OrganizationProfileSchema, { kind, verificationLevel: 2 })),
        }),
      }),
      listWarehouses: handlers.listWarehouses,
    });
    router.service(NetworkService, {
      listCities: () => create(ListCitiesResponseSchema, {
        cities: [create(CitySchema, { id: 'city-rostov', name: 'Ростов-на-Дону' })],
      }),
      listMapNodes: () => create(ListMapNodesResponseSchema, {
        mapNodes: [create(MapNodeSchema, { cityId: 'city-rostov', id: 'node-rostov' })],
      }),
      listMapSites: handlers.listMapSites,
      listRouteLegs: () => create(ListRouteLegsResponseSchema, {}),
    });
    router.service(OrganizationShowcaseService, { listOrganizationShowcases: handlers.listOrganizationShowcases });
    router.service(CatalogService, { listOwnListings: handlers.listOwnListings });
    router.service(ShowcaseService, { listShowcaseListings: handlers.listShowcaseListings });
  },
});

interface HookPropsValue {
  organizationId: string | undefined;
  query: string;
}

interface RenderedSearchValue {
  queryClient: QueryClient;
  rerender: (props: HookPropsValue) => void;
  result: { current: ReturnType<typeof useGlobalSearch> };
  runtime: ApiRuntimeValue;
}

const renderSearch = (
  persona: PersonaValue,
  handlers: HandlersValue,
  initialProps: HookPropsValue,
): RenderedSearchValue => {
  const runtime = createRuntime(persona, handlers);
  const queryClient = new QueryClient({ defaultOptions: { queries: { networkMode: 'always', retry: false } } });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  const { rerender, result } = renderHook(
    ({ organizationId, query }: HookPropsValue) => useGlobalSearch(query, organizationId),
    { initialProps, wrapper: Wrapper },
  );

  return { queryClient, rerender, result, runtime };
};

const getGroupIds = (value: ReturnType<typeof useGlobalSearch>): string[] => value.groups.map(group => group.id);

describe('useGlobalSearch', () => {
  afterEach(() => {
    cleanup();
  });

  it('reports idle for an empty query and too-short for one letter without any request', async () => {
    const handlers = createHandlers();
    const { rerender, result } = renderSearch(SUPPLIER, handlers, { organizationId: TEST_ORGANIZATION_ID, query: '' });

    expect(result.current).toMatchObject({ groups: [], normalizedQuery: '', status: 'idle' });

    rerender({ organizationId: TEST_ORGANIZATION_ID, query: ' Я ' });

    expect(result.current).toMatchObject({ groups: [], normalizedQuery: 'я', status: 'too-short' });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    expect(handlers.listOwnListings).not.toHaveBeenCalled();
    expect(handlers.listOrganizationShowcases).not.toHaveBeenCalled();
    expect(handlers.listMapSites).not.toHaveBeenCalled();
  });

  it('reports no-sources for a persona without a single source and requests nothing', async () => {
    const handlers = createHandlers();
    const { result } = renderSearch(ACCOUNTANT, handlers, { organizationId: TEST_ORGANIZATION_ID, query: 'яблоки' });

    await waitFor(() => {
      expect(result.current.status).toBe('no-sources');
    });

    expect(handlers.listOwnListings).not.toHaveBeenCalled();
    expect(handlers.listOrganizationShowcases).not.toHaveBeenCalled();
  });

  it('finds companies and the own catalog of a supplier in a fixed order and no showcase', async () => {
    const handlers = createHandlers();
    const { result } = renderSearch(SUPPLIER, handlers, { organizationId: TEST_ORGANIZATION_ID, query: 'голден' });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
      expect(result.current.groups.every(group => group.status === 'ready')).toBe(true);
    });

    expect(getGroupIds(result.current)).toEqual(['organizations', 'own-listings']);
    expect(result.current.groups[0]?.options[0]).toMatchObject({ objectId: 'org-2', title: 'Голден Фрут' });
    expect(result.current.groups[1]?.options[0]).toMatchObject({
      address: { kind: 'object', object: { id: 'listing-own-1', type: 'listing' } },
      objectId: 'listing-own-1',
    });
    expect(handlers.listShowcaseListings).not.toHaveBeenCalled();
  });

  it('finds a company whose name has the yo letter by a query without it', async () => {
    const { result } = renderSearch(SUPPLIER, createHandlers(), {
      organizationId: TEST_ORGANIZATION_ID,
      query: 'теплый',
    });

    await waitFor(() => {
      expect(getGroupIds(result.current)).toContain('organizations');
    });

    expect(result.current.groups[0]?.options[0]).toMatchObject({
      detail: { kind: 'organization', sides: ['supplier'] },
      objectId: 'org-1',
      titleMatches: [{ end: 6, start: 0 }],
    });
  });

  it('finds the showcase listings of a verified customer', async () => {
    const handlers = createHandlers();
    const { result } = renderSearch(CUSTOMER, handlers, { organizationId: TEST_ORGANIZATION_ID, query: 'голден' });

    await waitFor(() => {
      expect(getGroupIds(result.current)).toContain('showcase-listings');
    });

    expect(handlers.listOwnListings).not.toHaveBeenCalled();
    expect(handlers.listShowcaseListings).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'голден', sphereId: '', toWarehouseId: '' }),
      expect.anything(),
    );
  });

  it('finds a foreign site only by its city and names it after the company', async () => {
    const { result } = renderSearch(SUPPLIER, createHandlers(), {
      organizationId: TEST_ORGANIZATION_ID,
      query: 'ростов',
    });

    await waitFor(() => {
      expect(getGroupIds(result.current)).toContain('sites');
    });

    const sites = result.current.groups.find(group => group.id === 'sites');

    expect(sites?.options).toMatchObject([{
      detail: { cityName: 'Ростов-на-Дону', isOwn: false, organizationName: 'Голден Фрут' },
      title: 'Голден Фрут',
      titleMatches: [],
    }]);
  });

  it('searches the own warehouses of a storekeeper without asking for the network', async () => {
    const handlers = createHandlers();
    const { result } = renderSearch(STOREKEEPER, handlers, { organizationId: TEST_ORGANIZATION_ID, query: 'главный' });

    await waitFor(() => {
      expect(getGroupIds(result.current)).toEqual(['sites']);
    });

    expect(result.current.groups[0]?.options[0]).toMatchObject({
      address: { kind: 'object', object: { id: 'warehouse-1', type: 'warehouse' } },
      detail: { organizationName: 'Свежий рынок' },
    });
    expect(handlers.listMapSites).not.toHaveBeenCalled();
    expect(handlers.listOrganizationShowcases).not.toHaveBeenCalled();
  });

  it('shows the local groups at once and waits for the delay before asking the server, once for the last query', async () => {
    const handlers = createHandlers();
    const { rerender, result } = renderSearch(SUPPLIER, handlers, { organizationId: TEST_ORGANIZATION_ID, query: '' });

    rerender({ organizationId: TEST_ORGANIZATION_ID, query: 'го' });
    rerender({ organizationId: TEST_ORGANIZATION_ID, query: 'гол' });
    rerender({ organizationId: TEST_ORGANIZATION_ID, query: 'голден' });

    await waitFor(() => {
      expect(getGroupIds(result.current)).toContain('organizations');
    });

    expect(handlers.listOwnListings).not.toHaveBeenCalled();
    expect(result.current.groups.find(group => group.id === 'own-listings')?.status ?? 'loading').toBe('loading');

    await waitFor(() => {
      expect(result.current.groups.find(group => group.id === 'own-listings')?.status).toBe('ready');
    });

    const requests = handlers.listOwnListings.mock.calls.map(([request]) => request.query);

    expect(requests).toEqual(['голден']);
  });

  it('shows a loading group without rows for the first server query and keeps the previous rows for the next ones', async () => {
    const handlers = createHandlers();
    handlers.listOwnListings
      .mockImplementationOnce(() => createOwnListingsResponse('listing-first', 'Голден фрукты первые'))
      .mockImplementation(() => createOwnListingsResponse('listing-second', 'Голден фрукты вторые'));
    const { rerender, result } = renderSearch(SUPPLIER, handlers, { organizationId: TEST_ORGANIZATION_ID, query: '' });

    rerender({ organizationId: TEST_ORGANIZATION_ID, query: 'голден' });

    const findOwnGroup = (): SearchGroupValue | undefined => (
      result.current.groups.find(group => group.id === 'own-listings')
    );

    await waitFor(() => {
      expect(getGroupIds(result.current)).toContain('organizations');
    });

    expect(findOwnGroup()).toMatchObject({ isStale: false, options: [], status: 'loading' });

    await waitFor(() => {
      expect(findOwnGroup()).toMatchObject({ isStale: false, status: 'ready' });
    });

    expect(findOwnGroup()?.options[0]?.objectId).toBe('listing-first');

    rerender({ organizationId: TEST_ORGANIZATION_ID, query: 'голден ф' });

    expect(findOwnGroup()).toMatchObject({ isStale: true, status: 'ready' });
    expect(findOwnGroup()?.options[0]?.objectId).toBe('listing-first');
    expect(handlers.listOwnListings).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(findOwnGroup()).toMatchObject({ isStale: false, status: 'ready' });
    });

    expect(findOwnGroup()?.options[0]?.objectId).toBe('listing-second');
    expect(handlers.listOwnListings).toHaveBeenCalledTimes(2);
  });

  it('keeps the stale rows through several keystrokes and asks the server once', async () => {
    const handlers = createHandlers();
    handlers.listOwnListings.mockImplementation(() => createOwnListingsResponse('listing-own-1', 'Голден фрукты'));
    const { rerender, result } = renderSearch(SUPPLIER, handlers, { organizationId: TEST_ORGANIZATION_ID, query: 'голден' });

    await waitFor(() => {
      expect(result.current.groups.find(group => group.id === 'own-listings')?.status).toBe('ready');
    });

    rerender({ organizationId: TEST_ORGANIZATION_ID, query: 'голден ф' });
    rerender({ organizationId: TEST_ORGANIZATION_ID, query: 'голден фр' });

    expect(result.current.groups.find(group => group.id === 'own-listings')).toMatchObject({
      isStale: true,
      status: 'ready',
    });

    await waitFor(() => {
      expect(result.current.groups.find(group => group.id === 'own-listings')?.isStale).toBe(false);
    });

    expect(handlers.listOwnListings.mock.calls.map(([request]) => request.query)).toEqual(['голден', 'голден фр']);
  });

  it('keeps the result of a query out of the key of another query and normalizes the key', async () => {
    const handlers = createHandlers();
    const { queryClient, result } = renderSearch(SUPPLIER, handlers, {
      organizationId: TEST_ORGANIZATION_ID,
      query: '  ГОЛДЕН   ',
    });

    await waitFor(() => {
      expect(result.current.groups.find(group => group.id === 'own-listings')?.status).toBe('ready');
    });

    const scope = TEST_ORGANIZATION_ID;

    expect(queryClient.getQueryData(globalSearchKeys.ownListings(scope, 'голден'))).toBeDefined();
    expect(queryClient.getQueryData(globalSearchKeys.ownListings(scope, 'голд'))).toBeUndefined();
  });

  it('drops the results of the previous organization after a switch', async () => {
    const handlers = createHandlers();
    handlers.listOwnListings
      .mockImplementationOnce(() => createOwnListingsResponse('listing-first', 'Яблоки первой'))
      .mockImplementation(() => createOwnListingsResponse('listing-second', 'Яблоки второй'));
    const { queryClient, rerender, result, runtime } = renderSearch(SUPPLIER, handlers, {
      organizationId: TEST_ORGANIZATION_ID,
      query: 'яблоки',
    });

    await waitFor(() => {
      expect(result.current.groups.find(group => group.id === 'own-listings')?.options[0]?.objectId).toBe('listing-first');
    });

    queryClient.setQueryData(
      sessionKeys.current(OTHER_ORGANIZATION_ID, TEST_USER_ID),
      queryClient.getQueryData(sessionKeys.current(TEST_ORGANIZATION_ID, TEST_USER_ID)),
    );
    queryClient.setQueryData(
      organizationKeys.detail(OTHER_ORGANIZATION_ID),
      queryClient.getQueryData(organizationKeys.detail(TEST_ORGANIZATION_ID)),
    );

    act(() => {
      runtime.actingContext.set({ organizationId: OTHER_ORGANIZATION_ID, userId: TEST_USER_ID });
    });
    rerender({ organizationId: OTHER_ORGANIZATION_ID, query: 'яблоки' });

    const ownGroup = result.current.groups.find(group => group.id === 'own-listings');

    expect(ownGroup?.status).toBe('loading');
    expect(ownGroup?.options).toEqual([]);

    await waitFor(() => {
      expect(result.current.groups.find(group => group.id === 'own-listings')?.options[0]?.objectId).toBe('listing-second');
    });

    expect(queryClient.getQueryData(globalSearchKeys.ownListings(TEST_ORGANIZATION_ID, 'яблоки'))).toBeDefined();
    expect(queryClient.getQueryData(globalSearchKeys.ownListings(OTHER_ORGANIZATION_ID, 'яблоки'))).toBeDefined();
  });

  it('turns a failed source into an error group, keeps the others and recovers on retry', async () => {
    const handlers = createHandlers();
    handlers.listShowcaseListings
      .mockImplementationOnce(() => {
        throw new ConnectError('unavailable', Code.Unavailable);
      })
      .mockImplementation(() => create(ListShowcaseListingsResponseSchema, {
        listings: [create(ShowcaseListingSchema, { id: 'listing-showcase-2', productName: 'Яблоки' })],
      }));
    const { result } = renderSearch(CUSTOMER, handlers, { organizationId: TEST_ORGANIZATION_ID, query: 'голден' });

    await waitFor(() => {
      expect(result.current.groups.find(group => group.id === 'showcase-listings')?.status).toBe('error');
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.groups.find(group => group.id === 'organizations')?.status).toBe('ready');
    expect(result.current.groups.find(group => group.id === 'showcase-listings')?.error).toBeInstanceOf(Error);

    act(() => {
      result.current.groups.find(group => group.id === 'showcase-listings')?.retry();
    });

    await waitFor(() => {
      expect(result.current.groups.find(group => group.id === 'showcase-listings')?.status).toBe('ready');
    });

    const showcaseRequests = handlers.listShowcaseListings.mock.calls.map(([request]) => request.query);

    expect(showcaseRequests).toEqual(['голден', 'голден']);
  });

  it('reports empty when every source answered and nothing was found', async () => {
    const handlers = createHandlers();
    handlers.listOwnListings.mockImplementation(() => create(ListOwnListingsResponseSchema, {}));
    const { result } = renderSearch(SUPPLIER, handlers, { organizationId: TEST_ORGANIZATION_ID, query: 'ничего' });

    await waitFor(() => {
      expect(result.current.status).toBe('empty');
    });

    expect(result.current.groups).toEqual([]);
  });
});
