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
  ErrorCode,
  ErrorDetailSchema,
} from '@skladburg/contracts/common/v1/error';
import { QueryClient } from '@tanstack/react-query';
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from '@testing-library/react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  ApiRuntimeValue,
  DemoPersonaListItemValue,
  IDemoControl,
} from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';

import { createQueryClient } from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import { useFocusHandoff } from '@/shared/ui';

import {
  FRESH_BUYER_FIXTURE,
  FRESH_SELLER_FIXTURE,
  PERSONA_FIXTURES,
} from '../lib/testing/personaFixtures';
import {
  createPersonaDemoControl,
  createPersonaTestLocalizer,
  PersonaProviders,
  setActingPersona,
} from '../lib/testing/personaTestHarness';
import { usePersonaSwitch } from './usePersonaSwitch';

const FOCUS_KEY = 'profile-menu';

const createPersonaRuntime = (
  listPersonas: IDemoControl['listPersonas'],
  current: DemoPersonaListItemValue,
): ApiRuntimeValue => {
  const runtime = createTestRuntime({ demoControl: createPersonaDemoControl(listPersonas) });

  setActingPersona(runtime, current);

  return runtime;
};

const listAllPersonas: IDemoControl['listPersonas'] = () => Promise.resolve(PERSONA_FIXTURES);

interface SwitchWithHandoffValue {
  handoff: ReturnType<typeof useFocusHandoff<HTMLButtonElement>>;
  switcher: ReturnType<typeof usePersonaSwitch>;
}

const createCodedError = (): ConnectError => new ConnectError(
  'conflict',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code: ErrorCode.INVALID_TRANSITION }) }],
);

const getAnnouncement = (): string => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

const renderSwitchWithHandoff = async (
  runtime: ApiRuntimeValue,
  queryClient: QueryClient,
): Promise<{ result: { current: SwitchWithHandoffValue } }> => {
  const localizer: ILocalizer = await createPersonaTestLocalizer();

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <PersonaProviders localizer={localizer} queryClient={queryClient} runtime={runtime}>
      {children}
    </PersonaProviders>
  );

  return renderHook(
    (): SwitchWithHandoffValue => ({
      handoff: useFocusHandoff<HTMLButtonElement>(FOCUS_KEY),
      switcher: usePersonaSwitch(FOCUS_KEY),
    }),
    { wrapper: Wrapper },
  );
};

const renderSwitchHook = async (
  runtime: ApiRuntimeValue,
  queryClient: QueryClient = createQueryClient({ networkMode: 'always' }),
): Promise<{ result: { current: ReturnType<typeof usePersonaSwitch> } }> => {
  const localizer: ILocalizer = await createPersonaTestLocalizer();

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <PersonaProviders localizer={localizer} queryClient={queryClient} runtime={runtime}>
      {children}
    </PersonaProviders>
  );

  return renderHook(() => usePersonaSwitch(FOCUS_KEY), { wrapper: Wrapper });
};

describe('usePersonaSwitch', () => {
  afterEach(() => {
    cleanup();
  });

  it('formats a persona as the name, the role and the organization', async () => {
    const { result } = await renderSwitchHook(createPersonaRuntime(listAllPersonas, FRESH_BUYER_FIXTURE));

    expect(result.current.formatPersona(FRESH_BUYER_FIXTURE)).toBe('Анна Смирнова, Администратор · Покупатель 1');
    expect(result.current.formatPersonaSecondLine(FRESH_BUYER_FIXTURE)).toBe('Администратор · Покупатель 1');
  });

  it('leaves the role out when the persona has none', async () => {
    const { result } = await renderSwitchHook(createPersonaRuntime(listAllPersonas, FRESH_BUYER_FIXTURE));
    const withoutRole: DemoPersonaListItemValue = { ...FRESH_BUYER_FIXTURE, roleName: '' };

    expect(result.current.formatPersona(withoutRole)).toBe('Анна Смирнова, Покупатель 1');
    expect(result.current.formatPersonaSecondLine(withoutRole)).toBe('Покупатель 1');
  });

  it('finds the current persona by the acting context once the list is loaded', async () => {
    const { result } = await renderSwitchHook(createPersonaRuntime(listAllPersonas, FRESH_SELLER_FIXTURE));

    expect(result.current.isPending).toBe(true);
    expect(result.current.currentPersona).toBeUndefined();

    await waitFor(() => {
      expect(result.current.currentPersona).toEqual(FRESH_SELLER_FIXTURE);
    });
    expect(result.current.isPending).toBe(false);
    expect(result.current.personas).toEqual(PERSONA_FIXTURES);
  });

  it('switches the acting context to the chosen persona', async () => {
    const runtime = createPersonaRuntime(listAllPersonas, FRESH_BUYER_FIXTURE);
    const { result } = await renderSwitchHook(runtime);
    await waitFor(() => {
      expect(result.current.personas).toHaveLength(PERSONA_FIXTURES.length);
    });

    await act(async () => {
      await result.current.switchToPersona(FRESH_SELLER_FIXTURE.id);
    });

    expect(runtime.actingContext.get()).toEqual({
      organizationId: FRESH_SELLER_FIXTURE.organizationId,
      userId: FRESH_SELLER_FIXTURE.userId,
    });
  });

  it('ignores an unknown persona and the current one', async () => {
    const runtime = createPersonaRuntime(listAllPersonas, FRESH_BUYER_FIXTURE);
    const { result } = await renderSwitchHook(runtime);
    await waitFor(() => {
      expect(result.current.currentPersona).toEqual(FRESH_BUYER_FIXTURE);
    });
    const set = vi.spyOn(runtime.actingContext, 'set');

    await act(async () => {
      await result.current.switchToPersona('unknown');
      await result.current.switchToPersona(FRESH_BUYER_FIXTURE.id);
    });

    expect(set).not.toHaveBeenCalled();
  });

  it('keeps the error and asks for the list again on retry', async () => {
    const listPersonas = vi.fn<IDemoControl['listPersonas']>()
      .mockRejectedValueOnce(new Error('list failed'))
      .mockResolvedValue(PERSONA_FIXTURES);
    const runtime = createPersonaRuntime(listPersonas, FRESH_BUYER_FIXTURE);
    const { result } = await renderSwitchHook(runtime, new QueryClient({ defaultOptions: { queries: { retry: false } } }));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.personas).toEqual([]);

    act(() => {
      result.current.retryLoad();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(false);
    });
    await waitFor(() => {
      expect(result.current.personas).toEqual(PERSONA_FIXTURES);
    });
    expect(listPersonas).toHaveBeenCalledTimes(2);
  });

  it('announces the message of the error code and keeps the context when the switch fails with a coded error', async () => {
    const runtime = createPersonaRuntime(listAllPersonas, FRESH_BUYER_FIXTURE);
    const queryClient = createQueryClient({ networkMode: 'always' });
    vi.spyOn(queryClient, 'cancelQueries').mockRejectedValue(createCodedError());
    const { result } = await renderSwitchWithHandoff(runtime, queryClient);
    await waitFor(() => {
      expect(result.current.switcher.personas).toHaveLength(PERSONA_FIXTURES.length);
    });

    await act(async () => {
      await result.current.switcher.switchToPersona(FRESH_SELLER_FIXTURE.id);
    });

    expect(getAnnouncement()).toBe(defaultLocaleCatalog['error.invalid_transition']);
    expect(runtime.actingContext.get()).toEqual({
      organizationId: FRESH_BUYER_FIXTURE.organizationId,
      userId: FRESH_BUYER_FIXTURE.userId,
    });
    expect(result.current.switcher.isSwitching).toBe(false);
  });

  it('announces the common message when the switch fails without a code', async () => {
    const runtime = createPersonaRuntime(listAllPersonas, FRESH_BUYER_FIXTURE);
    const queryClient = createQueryClient({ networkMode: 'always' });
    vi.spyOn(queryClient, 'cancelQueries').mockRejectedValue(new Error('cancel failed'));
    const { result } = await renderSwitchWithHandoff(runtime, queryClient);
    await waitFor(() => {
      expect(result.current.switcher.personas).toHaveLength(PERSONA_FIXTURES.length);
    });

    await act(async () => {
      await result.current.switcher.switchToPersona(FRESH_SELLER_FIXTURE.id);
    });

    expect(getAnnouncement()).toBe(defaultLocaleCatalog['persona.switchError']);
  });

  it('drops the focus request when the switch fails, so a later element with the key does not take the focus', async () => {
    const runtime = createPersonaRuntime(listAllPersonas, FRESH_BUYER_FIXTURE);
    const queryClient = createQueryClient({ networkMode: 'always' });
    vi.spyOn(queryClient, 'cancelQueries').mockRejectedValue(createCodedError());
    const { result } = await renderSwitchWithHandoff(runtime, queryClient);
    await waitFor(() => {
      expect(result.current.switcher.personas).toHaveLength(PERSONA_FIXTURES.length);
    });

    await act(async () => {
      await result.current.switcher.switchToPersona(FRESH_SELLER_FIXTURE.id);
    });
    const lateTarget = document.body.appendChild(document.createElement('button'));
    result.current.handoff.ref(lateTarget);

    expect(document.activeElement).not.toBe(lateTarget);
    lateTarget.remove();
  });

  it('hands the focus to a later element with the key when the switch succeeds', async () => {
    const runtime = createPersonaRuntime(listAllPersonas, FRESH_BUYER_FIXTURE);
    const { result } = await renderSwitchWithHandoff(runtime, createQueryClient({ networkMode: 'always' }));
    await waitFor(() => {
      expect(result.current.switcher.personas).toHaveLength(PERSONA_FIXTURES.length);
    });

    await act(async () => {
      await result.current.switcher.switchToPersona(FRESH_SELLER_FIXTURE.id);
    });
    const lateTarget = document.body.appendChild(document.createElement('button'));
    result.current.handoff.ref(lateTarget);

    expect(document.activeElement).toBe(lateTarget);
    lateTarget.remove();
  });
});
