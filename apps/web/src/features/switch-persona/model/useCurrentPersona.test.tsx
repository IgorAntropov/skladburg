import type {
  ReactElement,
  ReactNode,
} from 'react';

import { QueryClient } from '@tanstack/react-query';
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
} from 'vitest';

import type {
  ApiRuntimeValue,
  DemoPersonaListItemValue,
  IDemoControl,
} from '@/shared/api';

import { createQueryClient } from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';

import {
  FRESH_CUSTOMER_FIXTURE,
  FRESH_SUPPLIER_FIXTURE,
  PERSONA_FIXTURES,
} from '../lib/testing/personaFixtures';
import {
  createPersonaDemoControl,
  createPersonaTestLocalizer,
  PersonaProviders,
  setActingPersona,
} from '../lib/testing/personaTestHarness';
import { useCurrentPersona } from './useCurrentPersona';

const createPersonaRuntime = (
  listPersonas: IDemoControl['listPersonas'],
  current: DemoPersonaListItemValue,
): ApiRuntimeValue => {
  const runtime = createTestRuntime({ demoControl: createPersonaDemoControl(listPersonas) });

  setActingPersona(runtime, current);

  return runtime;
};

const listAllPersonas: IDemoControl['listPersonas'] = () => Promise.resolve(PERSONA_FIXTURES);

const renderCurrentPersonaHook = async (
  runtime: ApiRuntimeValue,
  queryClient: QueryClient = createQueryClient({ networkMode: 'always' }),
): Promise<{ result: { current: ReturnType<typeof useCurrentPersona> } }> => {
  const localizer = await createPersonaTestLocalizer();

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <PersonaProviders localizer={localizer} queryClient={queryClient} runtime={runtime}>
      {children}
    </PersonaProviders>
  );

  return renderHook(useCurrentPersona, { wrapper: Wrapper });
};

describe('useCurrentPersona', () => {
  afterEach(() => {
    cleanup();
  });

  it('is pending without a persona until the list arrives, then returns the persona of the acting context', async () => {
    const { result } = await renderCurrentPersonaHook(createPersonaRuntime(listAllPersonas, FRESH_SUPPLIER_FIXTURE));

    expect(result.current).toEqual({ isPending: true, persona: undefined });

    await waitFor(() => {
      expect(result.current).toEqual({ isPending: false, persona: FRESH_SUPPLIER_FIXTURE });
    });
  });

  it('follows the acting context', async () => {
    const runtime = createPersonaRuntime(listAllPersonas, FRESH_CUSTOMER_FIXTURE);
    const { result } = await renderCurrentPersonaHook(runtime);
    await waitFor(() => {
      expect(result.current.persona).toEqual(FRESH_CUSTOMER_FIXTURE);
    });

    act(() => {
      runtime.actingContext.set({ organizationId: FRESH_SUPPLIER_FIXTURE.organizationId, userId: FRESH_SUPPLIER_FIXTURE.userId });
    });

    expect(result.current.persona).toEqual(FRESH_SUPPLIER_FIXTURE);
  });

  it('stops being pending without a persona when the list cannot be loaded', async () => {
    const runtime = createPersonaRuntime(() => Promise.reject(new Error('list failed')), FRESH_CUSTOMER_FIXTURE);
    const { result } = await renderCurrentPersonaHook(runtime, new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.persona).toBeUndefined();
  });

  it('is not pending and has no persona outside the demo', async () => {
    const { result } = await renderCurrentPersonaHook(createTestRuntime());

    expect(result.current).toEqual({ isPending: false, persona: undefined });
  });
});
