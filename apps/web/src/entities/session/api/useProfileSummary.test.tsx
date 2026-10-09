import type { GetSessionResponse } from '@skladburg/contracts/access/v1/access';
import type { RenderHookResult } from '@testing-library/react';
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
  GetSessionResponseSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  OrganizationProfileSchema,
  OrganizationSchema,
  ProfileKind,
} from '@skladburg/contracts/organization/v1/organization';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
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
} from 'vitest';

import type { ApiRuntimeValue } from '@/shared/api';

import { ApiRuntimeProvider } from '@/shared/api';
import {
  createTestRuntime,
  TEST_ORGANIZATION_ID,
} from '@/shared/api/index.testing';

import { useProfileSummary } from './useProfileSummary';

const createSession = (hasUser: boolean): GetSessionResponse => create(GetSessionResponseSchema, {
  actingOrganizationId: TEST_ORGANIZATION_ID,
  organizations: [
    create(OrganizationSchema, {
      id: TEST_ORGANIZATION_ID,
      name: 'Покупатель 1',
      profiles: [create(OrganizationProfileSchema, { kind: ProfileKind.BUYER })],
    }),
  ],
  user: hasUser ? { displayName: 'Анна Смирнова', id: 'user-1' } : undefined,
});

const renderSummaryHook = (runtime: ApiRuntimeValue): RenderHookResult<ReturnType<typeof useProfileSummary>, unknown> => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { networkMode: 'always', retry: false } } });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  return renderHook(useProfileSummary, { wrapper: Wrapper });
};

describe('useProfileSummary', () => {
  afterEach(() => {
    cleanup();
  });

  it('is pending while the session loads and ready with the summary after', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(AccessService, { getSession: () => createSession(true) }),
    });

    const { result } = renderSummaryHook(runtime);

    expect(result.current).toEqual({ kind: 'pending' });

    await waitFor(() => {
      expect(result.current.kind).toBe('ready');
    });

    expect(result.current).toEqual({
      kind: 'ready',
      summary: {
        organizationId: TEST_ORGANIZATION_ID,
        organizationName: 'Покупатель 1',
        sides: [ProfileKind.BUYER],
        userDisplayName: 'Анна Смирнова',
        userId: 'user-1',
      },
    });
  });

  it('is pending while there is no acting organization and nothing is requested', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(AccessService, { getSession: () => createSession(true) }),
    });
    runtime.actingContext.set({ organizationId: undefined, userId: undefined });

    const { result } = renderSummaryHook(runtime);

    await Promise.resolve();

    expect(result.current).toEqual({ kind: 'pending' });
  });

  it('is an error when the session request fails', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(AccessService, {
        getSession: () => {
          throw new ConnectError('denied', Code.PermissionDenied);
        },
      }),
    });

    const { result } = renderSummaryHook(runtime);

    await waitFor(() => {
      expect(result.current).toEqual({ kind: 'error' });
    });
  });

  it('is an error when the session has no user to describe', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(AccessService, { getSession: () => createSession(false) }),
    });

    const { result } = renderSummaryHook(runtime);

    await waitFor(() => {
      expect(result.current).toEqual({ kind: 'error' });
    });
  });

  it('keeps the same state object between renders of the same session', async () => {
    const runtime = createTestRuntime({
      routes: router => router.service(AccessService, { getSession: () => createSession(true) }),
    });

    const { rerender, result } = renderSummaryHook(runtime);

    await waitFor(() => {
      expect(result.current.kind).toBe('ready');
    });

    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });
});
