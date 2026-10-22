import type { QueryClient } from '@tanstack/react-query';
import type {
  ReactElement,
  ReactNode,
} from 'react';

import { create } from '@bufbuild/protobuf';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  type ListOrganizationShowcasesRequest,
  type ListOrganizationShowcasesResponse,
  ListOrganizationShowcasesResponseSchema,
  OrganizationShowcaseSchema,
  OrganizationShowcaseService,
} from '@skladburg/contracts/organization/v1/showcase';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { ApiRuntimeValue } from '@/shared/api';

import {
  ApiRuntimeProvider,
  createQueryClient,
} from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';

import type { OrganizationDirectoryFilterValue } from '../../model/organizationDirectoryFilter';

import { DEFAULT_ORGANIZATION_DIRECTORY_FILTER } from '../../model/organizationDirectoryFilter';
import { organizationShowcaseKeys } from './organizationShowcaseKeys';
import { useOrganizationShowcasesQuery } from './useOrganizationShowcasesQuery';

const SPHERE_ID = 'f2000001-0000-4000-8000-000000000000';

const createResponse = (ids: readonly string[], nextPageToken: string): ListOrganizationShowcasesResponse => create(
  ListOrganizationShowcasesResponseSchema,
  {
    organizations: ids.map(id => create(OrganizationShowcaseSchema, { id })),
    page: { nextPageToken },
  },
);

const createWrapper = (
  runtime: ApiRuntimeValue,
  queryClient: QueryClient,
): (props: { children: ReactNode }) => ReactElement => {
  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  return Wrapper;
};

const FILTERED: OrganizationDirectoryFilterValue = {
  minVerificationLevel: 2,
  profileKind: ProfileKind.CARRIER,
  sphereId: SPHERE_ID,
};

describe('useOrganizationShowcasesQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('sends the fields of the filter and stores every page under a key with the filter', async () => {
    const listOrganizationShowcases = vi.fn((request: ListOrganizationShowcasesRequest): ListOrganizationShowcasesResponse => (
      request.page?.pageToken === 'second' ? createResponse(['org-3'], '') : createResponse(['org-1', 'org-2'], 'second')
    ));
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationShowcaseService, { listOrganizationShowcases }),
    });
    const queryClient = createQueryClient({ networkMode: 'always' });

    const Wrapper = createWrapper(runtime, queryClient);

    const { result } = renderHook(() => useOrganizationShowcasesQuery(FILTERED), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({
      exact: true,
      queryKey: organizationShowcaseKeys.list(TEST_ORGANIZATION_ID, FILTERED),
    });

    expect(query?.meta).toEqual({ channels: [] });
    expect(result.current.data?.map(organization => organization.id)).toEqual(['org-1', 'org-2', 'org-3']);
    expect(listOrganizationShowcases).toHaveBeenCalledTimes(2);
    expect(listOrganizationShowcases.mock.calls[0]?.[0]).toMatchObject({
      minVerificationLevel: 2,
      profileKind: ProfileKind.CARRIER,
      sphereId: SPHERE_ID,
    });
  });

  it('asks again under another key when the filter changes and keeps the previous list until the answer comes', async () => {
    const listOrganizationShowcases = vi.fn((request: ListOrganizationShowcasesRequest): ListOrganizationShowcasesResponse => (
      request.minVerificationLevel === 0 ? createResponse(['org-1', 'org-2'], '') : createResponse(['org-2'], '')
    ));
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationShowcaseService, { listOrganizationShowcases }),
    });
    const queryClient = createQueryClient({ networkMode: 'always' });

    const Wrapper = createWrapper(runtime, queryClient);

    const { rerender, result } = renderHook(
      ({ filter }: { filter: OrganizationDirectoryFilterValue }) => useOrganizationShowcasesQuery(filter),
      { initialProps: { filter: DEFAULT_ORGANIZATION_DIRECTORY_FILTER }, wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.data?.map(organization => organization.id)).toEqual(['org-1', 'org-2']);
    });

    rerender({ filter: { ...DEFAULT_ORGANIZATION_DIRECTORY_FILTER, minVerificationLevel: 3 } });

    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.map(organization => organization.id)).toEqual(['org-1', 'org-2']);

    await waitFor(() => {
      expect(result.current.data?.map(organization => organization.id)).toEqual(['org-2']);
    });

    expect(result.current.isPlaceholderData).toBe(false);
    expect(listOrganizationShowcases).toHaveBeenCalledTimes(2);
  });

  it('does not request the list without an acting organization', () => {
    const listOrganizationShowcases = vi.fn((): ListOrganizationShowcasesResponse => createResponse([], ''));
    const runtime = createTestRuntime({
      routes: router => router.service(OrganizationShowcaseService, { listOrganizationShowcases }),
    });
    runtime.actingContext.set({ organizationId: undefined, userId: undefined });
    const queryClient = createQueryClient({ networkMode: 'always' });

    const Wrapper = createWrapper(runtime, queryClient);

    const { result } = renderHook(() => useOrganizationShowcasesQuery(DEFAULT_ORGANIZATION_DIRECTORY_FILTER), { wrapper: Wrapper });

    expect(listOrganizationShowcases).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
