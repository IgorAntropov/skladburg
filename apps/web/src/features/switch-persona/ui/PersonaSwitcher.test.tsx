import {
  createInProcessEngineConnection,
  SeedOrganizationId,
  SeedPersonaId,
  SeedUserId,
} from '@skladburg/demo-engine/testing';
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

import type {
  ApiRuntimeValue,
  DemoPersonaListItemValue,
  IDemoControl,
} from '@/shared/api';
import type { ILocalizer } from '@/shared/i18n';

import {
  ApiRuntimeProvider,
  createApiRuntime,
  createQueryClient,
  DemoPersonaKind,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';

import { PersonaSwitcher } from './PersonaSwitcher';

const FIRST_PERSONA: DemoPersonaListItemValue = {
  id: 'f9000001-0000-4000-8000-000000000000',
  kind: DemoPersonaKind.BUYER,
  organizationId: 'f0000001-0000-4000-8000-000000000000',
  organizationName: 'Север-Опт',
  userId: 'f0000002-0000-4000-8000-000000000000',
};
const SECOND_PERSONA: DemoPersonaListItemValue = {
  id: 'f9000002-0000-4000-8000-000000000000',
  kind: DemoPersonaKind.STOREKEEPER,
  organizationId: 'f0000001-0000-4000-8000-000000000000',
  organizationName: 'Север-Опт',
  userId: 'f9200002-0000-4000-8000-000000000000',
};

const closers: (() => Promise<void>)[] = [];

const kindTitles = {
  [DemoPersonaKind.BUYER]: defaultLocaleCatalog['persona.kind.buyer'],
  [DemoPersonaKind.CARRIER]: defaultLocaleCatalog['persona.kind.carrier'],
  [DemoPersonaKind.SELLER]: defaultLocaleCatalog['persona.kind.seller'],
  [DemoPersonaKind.STOREKEEPER]: defaultLocaleCatalog['persona.kind.storekeeper'],
} as const;

const formatOption = (persona: DemoPersonaListItemValue): string => defaultLocaleCatalog['persona.option']
  .replace('{kind}', kindTitles[persona.kind])
  .replace('{organization}', persona.organizationName);

const createDemoControl = (listPersonas: IDemoControl['listPersonas']): IDemoControl => ({
  listPersonas,
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset: () => Promise.resolve(),
});

const createTestLocalizer = (): Promise<ILocalizer> => createLocalizer({
  bundledLocales: ['ru'],
  catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
  requestedLocale: undefined,
  tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
  userTimeZone: 'UTC',
});

const renderSwitcher = async (
  runtime: ApiRuntimeValue,
  queryClient: QueryClient = createQueryClient({ networkMode: 'always' }),
): Promise<void> => {
  const localizer = await createTestLocalizer();

  render(
    <LocalizerProvider localizer={localizer}>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>
          <PersonaSwitcher />
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </LocalizerProvider>,
  );
};

const startEngineRuntime = async (personaId: string): Promise<ApiRuntimeValue> => {
  const inProcess = createInProcessEngineConnection();
  const runtime = await createApiRuntime({
    connection: inProcess.connection,
    defaultOrganizationId: SeedOrganizationId.BUYER_1,
    preferredPersonaId: personaId,
  });

  closers.push(async () => {
    runtime.close();
    await inProcess.close();
  });

  return runtime;
};

const getSelect = (): HTMLSelectElement => {
  const select = screen.getByRole('combobox', { name: defaultLocaleCatalog['persona.label'] });

  if (!(select instanceof HTMLSelectElement)) {
    throw new TypeError('The persona switcher is not a select');
  }

  return select;
};

const createDeferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe('PersonaSwitcher with the demo engine', () => {
  afterEach(async () => {
    cleanup();

    for (const close of closers.splice(0)) {
      await close();
    }
  });

  it('offers all eight personas with the kind from the catalog and the organization from the engine', async () => {
    const runtime = await startEngineRuntime(SeedPersonaId.FRESH_BUYER);
    const personas = await runtime.demoControl?.listPersonas() ?? [];

    await renderSwitcher(runtime);

    await waitFor(() => {
      expect(within(getSelect()).queryAllByRole('option')).toHaveLength(8);
    });

    const labels = within(getSelect()).getAllByRole('option').map(option => option.textContent);

    expect(personas).toHaveLength(8);
    expect(labels).toEqual(personas.map(formatOption));
    expect(labels).toContain(`${defaultLocaleCatalog['persona.kind.buyer']} · Покупатель 1`);
    expect(labels).toContain(`${defaultLocaleCatalog['persona.kind.storekeeper']} · Покупатель 1`);
    expect(new Set(labels).size).toBe(8);
  });

  it('shows the persona of the current acting context as chosen', async () => {
    const runtime = await startEngineRuntime(SeedPersonaId.FRESH_STOREKEEPER);

    await renderSwitcher(runtime);

    await waitFor(() => {
      expect(getSelect().value).toBe(SeedPersonaId.FRESH_STOREKEEPER);
    });

    expect(getSelect().selectedOptions[0]?.textContent).toBe(
      `${defaultLocaleCatalog['persona.kind.storekeeper']} · Покупатель 1`,
    );
  });

  it('switches the acting context to the chosen persona and keeps it chosen', async () => {
    const runtime = await startEngineRuntime(SeedPersonaId.FRESH_BUYER);

    await renderSwitcher(runtime);

    await waitFor(() => {
      expect(getSelect().value).toBe(SeedPersonaId.FRESH_BUYER);
    });

    fireEvent.change(getSelect(), { target: { value: SeedPersonaId.FRESH_STOREKEEPER } });

    await waitFor(() => {
      expect(runtime.actingContext.get()).toEqual({
        organizationId: SeedOrganizationId.BUYER_1,
        userId: SeedUserId.STOREKEEPER_1,
      });
    });
    await waitFor(() => {
      expect(getSelect().disabled).toBe(false);
      expect(getSelect().value).toBe(SeedPersonaId.FRESH_STOREKEEPER);
    });
  });

  it('switches to a persona of another organization', async () => {
    const runtime = await startEngineRuntime(SeedPersonaId.FRESH_BUYER);

    await renderSwitcher(runtime);

    await waitFor(() => {
      expect(getSelect().value).toBe(SeedPersonaId.FRESH_BUYER);
    });

    fireEvent.change(getSelect(), { target: { value: SeedPersonaId.FRESH_SELLER } });

    await waitFor(() => {
      expect(runtime.actingContext.get().organizationId).toBe(SeedOrganizationId.SELLER_1);
    });
    await waitFor(() => {
      expect(getSelect().value).toBe(SeedPersonaId.FRESH_SELLER);
    });
  });
});

describe('PersonaSwitcher states', () => {
  afterEach(() => {
    cleanup();
  });

  it('is busy and disabled while the context is being switched, then available again', async () => {
    const runtime = createTestRuntime({
      demoControl: createDemoControl(() => Promise.resolve([FIRST_PERSONA, SECOND_PERSONA])),
    });
    runtime.actingContext.set({ organizationId: FIRST_PERSONA.organizationId, userId: FIRST_PERSONA.userId });
    const queryClient = createQueryClient({ networkMode: 'always' });
    const deferred = createDeferred();
    vi.spyOn(queryClient, 'cancelQueries').mockReturnValue(deferred.promise);

    await renderSwitcher(runtime, queryClient);

    await waitFor(() => {
      expect(within(getSelect()).queryAllByRole('option')).toHaveLength(2);
    });

    expect(getSelect().disabled).toBe(false);
    expect(getSelect().getAttribute('aria-busy')).toBe('false');
    expect(screen.getByRole('status').textContent).toBe('');

    fireEvent.change(getSelect(), { target: { value: SECOND_PERSONA.id } });

    expect(getSelect().disabled).toBe(true);
    expect(getSelect().getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe(defaultLocaleCatalog['persona.switching']);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    await waitFor(() => {
      expect(getSelect().disabled).toBe(false);
    });

    expect(getSelect().getAttribute('aria-busy')).toBe('false');
    expect(runtime.actingContext.get().userId).toBe(SECOND_PERSONA.userId);
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('renders nothing in the pilot build without the demo control', async () => {
    const runtime = createTestRuntime();

    await renderSwitcher(runtime);

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText(defaultLocaleCatalog['persona.label'])).toBeNull();
    expect(document.body.textContent).toBe('');
  });

  it('shows a disabled select of the same shape without options while the list is loading', async () => {
    const deferred = createDeferred();
    const runtime = createTestRuntime({
      demoControl: createDemoControl(async () => {
        await deferred.promise;

        return [FIRST_PERSONA];
      }),
    });

    await renderSwitcher(runtime);

    const select = getSelect();

    expect(select.disabled).toBe(true);
    expect(select.getAttribute('aria-busy')).toBe('true');
    expect(within(select).queryAllByRole('option')).toHaveLength(0);
    expect(select.className).toContain('w-64');

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    await waitFor(() => {
      expect(within(getSelect()).queryAllByRole('option')).toHaveLength(1);
    });

    expect(getSelect().disabled).toBe(false);
    expect(getSelect().className).toBe(select.className);
  });

  it('renders nothing and logs when the list cannot be loaded', async () => {
    const log = vi.spyOn(console, 'log');
    const failure = new Error('list failed');
    const runtime = createTestRuntime({
      demoControl: createDemoControl(() => Promise.reject(failure)),
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await renderSwitcher(runtime, queryClient);

    await waitFor(() => {
      expect(screen.queryByRole('combobox')).toBeNull();
      expect(log).toHaveBeenCalledWith('> PersonaSwitcher -> reportPersonasError:', { error: failure });
    });

    expect(document.body.textContent).toBe('');
  });

  it('logs the choice and keeps the context when the switch fails', async () => {
    const log = vi.spyOn(console, 'log');
    const runtime = createTestRuntime({
      demoControl: createDemoControl(() => Promise.resolve([FIRST_PERSONA, SECOND_PERSONA])),
    });
    runtime.actingContext.set({ organizationId: FIRST_PERSONA.organizationId, userId: FIRST_PERSONA.userId });
    const queryClient = createQueryClient({ networkMode: 'always' });
    const failure = new Error('cancel failed');
    vi.spyOn(queryClient, 'cancelQueries').mockRejectedValue(failure);

    await renderSwitcher(runtime, queryClient);

    await waitFor(() => {
      expect(within(getSelect()).queryAllByRole('option')).toHaveLength(2);
    });

    fireEvent.change(getSelect(), { target: { value: SECOND_PERSONA.id } });

    await waitFor(() => {
      expect(log).toHaveBeenCalledWith('> PersonaSwitcher -> handlePersonaChange:', { personaId: SECOND_PERSONA.id });
      expect(log).toHaveBeenCalledWith('> PersonaSwitcher -> handlePersonaChange:', {
        personaId: SECOND_PERSONA.id,
        switchError: failure,
      });
    });
    await waitFor(() => {
      expect(getSelect().disabled).toBe(false);
    });

    expect(runtime.actingContext.get().userId).toBe(FIRST_PERSONA.userId);
  });
});
