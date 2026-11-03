import type { ReactElement } from 'react';

import { create } from '@bufbuild/protobuf';
import {
  AccessService,
  EffectivePermissionSchema,
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  CatalogService,
  ListingSchema,
  ListOwnListingsResponseSchema,
  OwnListingSchema,
  ProductSchema,
} from '@skladburg/contracts/catalog/v1/catalog';
import {
  CitySchema,
  ListCitiesResponseSchema,
  ListMapNodesResponseSchema,
  ListMapSitesResponseSchema,
  ListRouteLegsResponseSchema,
  MapNodeSchema,
  NetworkService,
} from '@skladburg/contracts/network/v1/network';
import {
  GetOrganizationResponseSchema,
  OrganizationProfileSchema,
  OrganizationSchema,
  OrganizationService,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
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
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  useRef,
  useState,
} from 'react';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import {
  ApiRuntimeProvider,
  type ApiRuntimeValue,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';
import { withTestLocalizer } from '@/shared/i18n/index.testing';
import { RoutingProvider } from '@/shared/routing';
import {
  createMemoryLocation,
  type IMemoryLocation,
} from '@/shared/routing/index.testing';
import {
  createThemePreferenceStore,
  ThemePreferenceProvider,
} from '@/shared/theme';
import { LiveRegionProvider } from '@/shared/ui';

import { SearchController } from './SearchController';

const themeStore = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });

const SUPPLIER_PERMISSIONS: readonly KnownPermissionCode[] = [PermissionCode.CATALOG_VIEW, PermissionCode.NETWORK_VIEW];

const OTHER_ORGANIZATION_ID = 'f0000003-0000-4000-8000-000000000000';
const OWN_LISTING_ID = 'listing-own-1';
const FIRST_ORGANIZATION_ID = 'org-golden';

const SKELETON_FILLED_WAIT_MS = 500;

const createRuntime = (ownListingsGate: Promise<void>): ApiRuntimeValue => createTestRuntime({
  routes: (router) => {
    router.service(AccessService, {
      getSession: () => create(GetSessionResponseSchema, {
        permissions: SUPPLIER_PERMISSIONS.map(code => (
          create(EffectivePermissionSchema, { isOrganizationWide: true, permission: getPermissionName(code) })
        )),
      }),
    });
    router.service(OrganizationService, {
      getOrganization: () => create(GetOrganizationResponseSchema, {
        organization: create(OrganizationSchema, {
          id: TEST_ORGANIZATION_ID,
          name: 'Тёплый угол',
          profiles: [create(OrganizationProfileSchema, { kind: ProfileKind.SUPPLIER, verificationLevel: 2 })],
        }),
      }),
    });
    router.service(NetworkService, {
      listCities: () => create(ListCitiesResponseSchema, {
        cities: [create(CitySchema, { id: 'city-rostov', name: 'Ростов-на-Дону' })],
      }),
      listMapNodes: () => create(ListMapNodesResponseSchema, {
        mapNodes: [create(MapNodeSchema, { cityId: 'city-rostov', id: 'node-rostov' })],
      }),
      listMapSites: () => create(ListMapSitesResponseSchema, {}),
      listRouteLegs: () => create(ListRouteLegsResponseSchema, {}),
    });
    router.service(OrganizationShowcaseService, {
      listOrganizationShowcases: () => create(ListOrganizationShowcasesResponseSchema, {
        organizations: [
          create(OrganizationShowcaseSchema, {
            id: FIRST_ORGANIZATION_ID,
            name: 'Голден Фрут',
            profiles: [create(OrganizationProfileSchema, { kind: ProfileKind.SUPPLIER, verificationLevel: 2 })],
          }),
          create(OrganizationShowcaseSchema, { id: OTHER_ORGANIZATION_ID, name: 'Свежий рынок' }),
        ],
      }),
    });
    router.service(CatalogService, {
      listOwnListings: async (request) => {
        await ownListingsGate;

        return create(ListOwnListingsResponseSchema, {
          listings: request.query.includes('голден') || request.query.includes('яблоки')
            ? [create(OwnListingSchema, {
                listing: create(ListingSchema, { id: OWN_LISTING_ID, isPublished: true }),
                product: create(ProductSchema, { id: 'product-1', name: 'Яблоки Голден' }),
              })]
            : [],
        });
      },
    });
  },
});

interface HarnessProps {
  pendingChooseQuery?: string | undefined;
}

const Harness = ({ pendingChooseQuery }: HarnessProps): ReactElement => {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');

  const handleChange = (event: { target: { value: string } }): void => {
    setQuery(event.target.value);
  };

  const handleNoop = (): void => undefined;

  return (
    <div ref={rootRef} role="search">
      <input
        aria-expanded="false"
        data-testid="input"
        onChange={handleChange}
        ref={inputRef}
        role="combobox"
        value={query}
      />
      <SearchController
        inputRef={inputRef}
        onFieldExit={handleNoop}
        onPendingChooseConsumed={handleNoop}
        onPhoneFieldClose={handleNoop}
        onQueryReset={handleNoop}
        organizationId={TEST_ORGANIZATION_ID}
        pendingChooseQuery={pendingChooseQuery}
        query={query}
        rootRef={rootRef}
      />
    </div>
  );
};

const renderSearch = (ownListingsGate: Promise<void> = Promise.resolve()): IMemoryLocation => {
  const location = createMemoryLocation('/catalog');
  const queryClient = new QueryClient({ defaultOptions: { queries: { networkMode: 'always', retry: false } } });

  render(withTestLocalizer(
    <ApiRuntimeProvider runtime={createRuntime(ownListingsGate)}>
      <QueryClientProvider client={queryClient}>
        <RoutingProvider location={location}>
          <ThemePreferenceProvider store={themeStore}>
            <LiveRegionProvider>
              <Harness />
            </LiveRegionProvider>
          </ThemePreferenceProvider>
        </RoutingProvider>
      </QueryClientProvider>
    </ApiRuntimeProvider>,
  ));

  return location;
};

const getInput = (): HTMLInputElement => {
  const input = screen.getByTestId('input');

  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError('The search input is not an input');
  }

  return input;
};

const openWithQuery = (value: string): void => {
  act(() => {
    getInput().focus();
  });
  fireEvent.input(getInput(), { target: { value } });
};

const getOptionId = (groupId: string, objectId: string): string => {
  const option = screen.getByTestId(`global-search-option-${groupId}-${objectId}`);

  return option.id;
};

describe('global search panel with its controller', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the groups in a fixed order, activates the first row once the answers settle and ties the listbox to the field', async () => {
    renderSearch();
    openWithQuery('голден');

    await screen.findByTestId(`global-search-option-own-listings-${OWN_LISTING_ID}`);

    const input = getInput();
    const listbox = screen.getByRole('listbox');
    const groups = screen.getAllByRole('group');

    expect(groups.map(group => group.getAttribute('data-testid'))).toEqual([
      'global-search-group-organizations',
      'global-search-group-own-listings',
    ]);
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(listbox.getAttribute('aria-label')).toBe('Результаты поиска');

    const firstOptionId = getOptionId('organizations', FIRST_ORGANIZATION_ID);

    await waitFor(() => {
      expect(input.getAttribute('aria-activedescendant')).toBe(firstOptionId);
    });

    expect(document.getElementById(firstOptionId)?.getAttribute('aria-selected')).toBe('true');
    expect(await screen.findByText('Нашёл 2 результата')).toBeDefined();
  });

  it('walks down through the groups with the arrow keys, wraps around and opens the active row on Enter', async () => {
    const location = renderSearch();
    openWithQuery('голден');
    await screen.findByTestId(`global-search-option-own-listings-${OWN_LISTING_ID}`);

    const input = getInput();
    const ownListingId = getOptionId('own-listings', OWN_LISTING_ID);
    const organizationId = getOptionId('organizations', FIRST_ORGANIZATION_ID);

    await waitFor(() => {
      expect(input.getAttribute('aria-activedescendant')).toBe(organizationId);
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(input.getAttribute('aria-activedescendant')).toBe(ownListingId);
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(input.getAttribute('aria-activedescendant')).toBe(organizationId);
    });

    fireEvent.keyDown(input, { key: 'ArrowUp' });

    await waitFor(() => {
      expect(input.getAttribute('aria-activedescendant')).toBe(ownListingId);
    });

    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(location.read().path).toBe(`/listings/${OWN_LISTING_ID}`);
    });

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keeps the active row off the field until the held skeleton of a late group gives way to its rows', async () => {
    let releaseOwnListings = (): void => undefined;
    const ownListingsGate = new Promise<void>((resolve) => {
      releaseOwnListings = resolve;
    });
    const missingActiveIds: string[] = [];
    renderSearch(ownListingsGate);

    const observer = new MutationObserver(() => {
      const activeId = getInput().getAttribute('aria-activedescendant');

      if (activeId !== null && document.getElementById(activeId) === null) {
        missingActiveIds.push(activeId);
      }
    });

    observer.observe(getInput(), { attributeFilter: ['aria-activedescendant'] });
    openWithQuery('яблоки');

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, SKELETON_FILLED_WAIT_MS);
      });
    });
    releaseOwnListings();

    await waitFor(() => {
      expect(getInput().getAttribute('aria-activedescendant')).toBe(getOptionId('own-listings', OWN_LISTING_ID));
    }, { timeout: 2000 });
    observer.disconnect();

    expect(missingActiveIds).toEqual([]);
  });

  it('opens the first row of the same query when Enter comes before the answers', async () => {
    const location = renderSearch();
    openWithQuery('голден');

    fireEvent.keyDown(getInput(), { key: 'Enter' });

    await waitFor(() => {
      expect(location.read().path).toContain(FIRST_ORGANIZATION_ID);
    });

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens the row under a click and makes a row active when the pointer moves over it', async () => {
    const location = renderSearch();
    openWithQuery('голден');
    const ownListing = await screen.findByTestId(`global-search-option-own-listings-${OWN_LISTING_ID}`);

    fireEvent.pointerMove(ownListing);

    await waitFor(() => {
      expect(getInput().getAttribute('aria-activedescendant')).toBe(ownListing.id);
    });

    fireEvent.click(ownListing);

    expect(location.read().path).toBe(`/listings/${OWN_LISTING_ID}`);
  });

  it('shows the empty state when nothing is found and does not move when Enter comes', async () => {
    const location = renderSearch();
    openWithQuery('ничего нет');
    fireEvent.keyDown(getInput(), { key: 'Enter' });

    expect(await screen.findByTestId('global-search-empty')).toBeDefined();
    expect(location.read().path).toBe('/catalog');
    expect(screen.getByTestId('global-search-empty').textContent).toContain('Ничего не нашёл');
  });

  it('shows the hint for an empty field and asks for one more letter after a single letter', async () => {
    renderSearch();
    act(() => {
      getInput().focus();
    });

    expect(await screen.findByTestId('global-search-idle')).toBeDefined();

    fireEvent.input(getInput(), { target: { value: 'я' } });

    expect(await screen.findByTestId('global-search-too-short')).toBeDefined();
    expect(screen.queryByTestId('global-search-idle')).toBeNull();
  });

  it('marks the matched part of the title', async () => {
    renderSearch();
    openWithQuery('голден');

    const row = await screen.findByTestId(`global-search-option-own-listings-${OWN_LISTING_ID}`);

    expect(Array.from(row.querySelectorAll('mark')).map(mark => mark.textContent)).toEqual(['Голден']);
  });
});
