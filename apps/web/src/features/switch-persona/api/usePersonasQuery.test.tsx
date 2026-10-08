import type { QueryClient } from '@tanstack/react-query';
import type {
  ReactElement,
  ReactNode,
} from 'react';

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

import type {
  DemoPersonaListItemValue,
  IDemoControl,
} from '@/shared/api';

import {
  ApiRuntimeProvider,
  createQueryClient,
  DemoPersonaKind,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';

import { personaKeys } from './personaKeys';
import { usePersonasQuery } from './usePersonasQuery';

const PERSONAS: readonly DemoPersonaListItemValue[] = [
  {
    id: 'f9000001-0000-4000-8000-000000000000',
    kind: DemoPersonaKind.BUYER,
    organizationId: 'f9100001-0000-4000-8000-000000000000',
    organizationName: 'Север-Опт',
    userId: 'f9200001-0000-4000-8000-000000000000',
  },
  {
    id: 'f9000002-0000-4000-8000-000000000000',
    kind: DemoPersonaKind.CARRIER,
    organizationId: 'f9100002-0000-4000-8000-000000000000',
    organizationName: 'Быстрый рейс',
    userId: 'f9200002-0000-4000-8000-000000000000',
  },
];

const createDemoControl = (listPersonas: IDemoControl['listPersonas']): IDemoControl => ({
  listPersonas,
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset: () => Promise.resolve(),
});

const renderPersonasHook = (
  demoControl: IDemoControl | undefined,
): { queryClient: QueryClient; result: { current: ReturnType<typeof usePersonasQuery> } } => {
  const runtime = createTestRuntime({ demoControl });
  const queryClient = createQueryClient({ networkMode: 'always' });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <ApiRuntimeProvider runtime={runtime}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiRuntimeProvider>
  );

  const { result } = renderHook(usePersonasQuery, { wrapper: Wrapper });

  return { queryClient, result };
};

describe('usePersonasQuery', () => {
  afterEach(() => {
    cleanup();
  });

  it('asks the demo control for the personas and keeps them under the personas key', async () => {
    const listPersonas = vi.fn(() => Promise.resolve(PERSONAS));

    const { queryClient, result } = renderPersonasHook(createDemoControl(listPersonas));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(PERSONAS);
    expect(listPersonas).toHaveBeenCalledTimes(1);
    expect(personaKeys.list).toEqual(['demo', 'personas']);
    expect(queryClient.getQueryCache().find({ exact: true, queryKey: personaKeys.list })?.state.data).toEqual(PERSONAS);
  });

  it('does not depend on the acting context in its key', async () => {
    const { queryClient, result } = renderPersonasHook(createDemoControl(() => Promise.resolve(PERSONAS)));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(queryClient.getQueryCache().findAll().map(query => query.queryKey)).toEqual([['demo', 'personas']]);
  });

  it('does not request anything without the demo control', async () => {
    const { result } = renderPersonasHook(undefined);

    await Promise.resolve();

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});
