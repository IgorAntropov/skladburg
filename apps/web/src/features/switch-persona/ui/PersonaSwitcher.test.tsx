import type {
  ReactElement,
  ReactNode,
} from 'react';
import type { MockInstance } from 'vitest';

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
} from '@testing-library/react';
import {
  useEffect,
  useState,
} from 'react';
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
import {
  FocusHandoffProvider,
  LiveRegionProvider,
  useFocusHandoff,
} from '@/shared/ui';

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

const LATE_LABEL = 'Late';
const SHOW_LATE_LABEL = 'Show late';

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

const FocusRequester = (): null => {
  const { requestFocus } = useFocusHandoff('persona-switcher');

  useEffect(() => {
    requestFocus();
  }, [requestFocus]);

  return null;
};

const LateFocusTarget = (): ReactElement => {
  const { ref } = useFocusHandoff<HTMLButtonElement>('persona-switcher');

  return <button ref={ref} type="button">{LATE_LABEL}</button>;
};

const LateFocusTargetLauncher = (): ReactElement => {
  const [isShown, setIsShown] = useState(false);

  const handleShowClick = (): void => {
    setIsShown(true);
  };

  return (
    <>
      <button onClick={handleShowClick} type="button">{SHOW_LATE_LABEL}</button>
      {isShown && <LateFocusTarget />}
    </>
  );
};

const createCodedError = (): ConnectError => new ConnectError(
  'conflict',
  Code.FailedPrecondition,
  undefined,
  [{ desc: ErrorDetailSchema, value: create(ErrorDetailSchema, { code: ErrorCode.INVALID_TRANSITION }) }],
);

const renderSwitcher = async (
  runtime: ApiRuntimeValue,
  queryClient: QueryClient = createQueryClient({ networkMode: 'always' }),
  className?: string,
  isFocusRequested = false,
  extra: ReactNode = null,
): Promise<void> => {
  const localizer = await createTestLocalizer();

  render(
    <LocalizerProvider localizer={localizer}>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>
          <LiveRegionProvider>
            <FocusHandoffProvider>
              {isFocusRequested && <FocusRequester />}
              <PersonaSwitcher className={className} focusKey="persona-switcher" />
              {extra}
            </FocusHandoffProvider>
          </LiveRegionProvider>
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

const getAnnouncement = (): string => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

const TRIGGER_NAME_PATTERN = new RegExp(`^${defaultLocaleCatalog['persona.label']}`);

const getTrigger = (): HTMLButtonElement => {
  const trigger = screen.getByRole('button', { hidden: true, name: TRIGGER_NAME_PATTERN });

  if (!(trigger instanceof HTMLButtonElement)) {
    throw new TypeError('The persona switcher trigger is not a button');
  }

  return trigger;
};

const getTriggerName = (persona: DemoPersonaListItemValue): string => defaultLocaleCatalog['persona.trigger.label']
  .replace('{persona}', formatOption(persona));

const openMenu = async (): Promise<HTMLElement> => {
  const trigger = getTrigger();

  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });

  return screen.findByRole('menu', { name: defaultLocaleCatalog['persona.label'] });
};

const getPersonaItem = (persona: DemoPersonaListItemValue): HTMLElement => screen.getByRole('menuitemradio', {
  name: formatOption(persona),
});

const chooseWithEnter = (item: HTMLElement): void => {
  item.focus();
  fireEvent.keyDown(item, { key: 'Enter' });
};

const createDeferred = (): { promise: Promise<void>; resolve: () => void } => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

const createTwoPersonaRuntime = (): ApiRuntimeValue => {
  const runtime = createTestRuntime({
    demoControl: createDemoControl(() => Promise.resolve([FIRST_PERSONA, SECOND_PERSONA])),
  });

  runtime.actingContext.set({ organizationId: FIRST_PERSONA.organizationId, userId: FIRST_PERSONA.userId });

  return runtime;
};

const waitForTriggerName = async (persona: DemoPersonaListItemValue): Promise<void> => {
  await waitFor(() => {
    expect(getTrigger().getAttribute('aria-label')).toBe(getTriggerName(persona));
  });
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
      expect(getTrigger().disabled).toBe(false);
    });
    await openMenu();

    const labels = screen.getAllByRole('menuitemradio').map(item => item.textContent);

    expect(personas).toHaveLength(8);
    expect(labels).toEqual(personas.map(formatOption));
    expect(labels).toContain(`${defaultLocaleCatalog['persona.kind.buyer']} · Покупатель 1`);
    expect(labels).toContain(`${defaultLocaleCatalog['persona.kind.storekeeper']} · Покупатель 1`);
    expect(new Set(labels).size).toBe(8);
  });

  it('shows the persona of the current acting context on the trigger and as the checked item', async () => {
    const runtime = await startEngineRuntime(SeedPersonaId.FRESH_STOREKEEPER);
    const personas = await runtime.demoControl?.listPersonas() ?? [];
    const storekeeper = personas.find(persona => persona.id === SeedPersonaId.FRESH_STOREKEEPER);

    await renderSwitcher(runtime);

    if (storekeeper === undefined) {
      throw new TypeError('The storekeeper persona is missing');
    }

    await waitForTriggerName(storekeeper);

    expect(getTrigger().textContent).toBe(
      `${defaultLocaleCatalog['persona.label']}${formatOption(storekeeper)}`,
    );

    await openMenu();

    const checkedItems = screen.getAllByRole('menuitemradio').filter(item => item.getAttribute('aria-checked') === 'true');

    expect(checkedItems.map(item => item.textContent)).toEqual([formatOption(storekeeper)]);
  });

  it('switches the acting context to the chosen persona and keeps it chosen', async () => {
    const runtime = await startEngineRuntime(SeedPersonaId.FRESH_BUYER);
    const personas = await runtime.demoControl?.listPersonas() ?? [];
    const storekeeper = personas.find(persona => persona.id === SeedPersonaId.FRESH_STOREKEEPER);

    await renderSwitcher(runtime);

    if (storekeeper === undefined) {
      throw new TypeError('The storekeeper persona is missing');
    }

    await waitFor(() => {
      expect(getTrigger().disabled).toBe(false);
    });
    await openMenu();
    chooseWithEnter(getPersonaItem(storekeeper));

    await waitFor(() => {
      expect(runtime.actingContext.get()).toEqual({
        organizationId: SeedOrganizationId.BUYER_1,
        userId: SeedUserId.STOREKEEPER_1,
      });
    });
    await waitForTriggerName(storekeeper);
    await waitFor(() => {
      expect(getTrigger().getAttribute('aria-disabled')).toBeNull();
    });
  });

  it('switches to a persona of another organization', async () => {
    const runtime = await startEngineRuntime(SeedPersonaId.FRESH_BUYER);
    const personas = await runtime.demoControl?.listPersonas() ?? [];
    const seller = personas.find(persona => persona.id === SeedPersonaId.FRESH_SELLER);

    await renderSwitcher(runtime);

    if (seller === undefined) {
      throw new TypeError('The seller persona is missing');
    }

    await waitFor(() => {
      expect(getTrigger().disabled).toBe(false);
    });
    await openMenu();
    chooseWithEnter(getPersonaItem(seller));

    await waitFor(() => {
      expect(runtime.actingContext.get().organizationId).toBe(SeedOrganizationId.SELLER_1);
    });
    await waitForTriggerName(seller);
  });
});

describe('PersonaSwitcher keyboard', () => {
  afterEach(() => {
    cleanup();
  });

  const renderTwoPersonas = async (): Promise<{ cancelQueries: MockInstance<QueryClient['cancelQueries']>; runtime: ApiRuntimeValue }> => {
    const runtime = createTwoPersonaRuntime();
    const queryClient = createQueryClient({ networkMode: 'always' });
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');

    await renderSwitcher(runtime, queryClient);
    await waitForTriggerName(FIRST_PERSONA);

    return { cancelQueries, runtime };
  };

  it('opens the menu on the arrow down of the closed trigger and does not switch the persona', async () => {
    const { cancelQueries, runtime } = await renderTwoPersonas();

    const menu = await openMenu();

    expect(menu).toBeDefined();
    expect(getTrigger().getAttribute('aria-expanded')).toBe('true');
    expect(cancelQueries).not.toHaveBeenCalled();
    expect(runtime.actingContext.get().userId).toBe(FIRST_PERSONA.userId);
  });

  it('does not switch the persona with the arrow keys inside the open menu', async () => {
    const { cancelQueries, runtime } = await renderTwoPersonas();

    const menu = await openMenu();

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    fireEvent.keyDown(menu, { key: 'Home' });
    fireEvent.keyDown(menu, { key: 'End' });

    expect(screen.getByRole('menu')).toBeDefined();
    expect(cancelQueries).not.toHaveBeenCalled();
    expect(runtime.actingContext.get().userId).toBe(FIRST_PERSONA.userId);
  });

  it('closes on Escape without switching the persona and returns the focus to the trigger', async () => {
    const { cancelQueries, runtime } = await renderTwoPersonas();

    const menu = await openMenu();

    fireEvent.keyDown(menu, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(getTrigger());
    });
    expect(cancelQueries).not.toHaveBeenCalled();
    expect(runtime.actingContext.get().userId).toBe(FIRST_PERSONA.userId);
  });

  it('switches the persona exactly once on Enter at another persona and closes the menu', async () => {
    const { cancelQueries, runtime } = await renderTwoPersonas();

    await openMenu();
    chooseWithEnter(getPersonaItem(SECOND_PERSONA));

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    await waitFor(() => {
      expect(runtime.actingContext.get().userId).toBe(SECOND_PERSONA.userId);
    });
    expect(cancelQueries).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the current persona is chosen again', async () => {
    const { cancelQueries, runtime } = await renderTwoPersonas();

    await openMenu();
    chooseWithEnter(getPersonaItem(FIRST_PERSONA));

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(cancelQueries).not.toHaveBeenCalled();
    expect(runtime.actingContext.get().userId).toBe(FIRST_PERSONA.userId);
  });

  it('marks only the current persona as checked and names the trigger with it', async () => {
    await renderTwoPersonas();

    await openMenu();

    expect(getPersonaItem(FIRST_PERSONA).getAttribute('aria-checked')).toBe('true');
    expect(getPersonaItem(SECOND_PERSONA).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('group', { name: defaultLocaleCatalog['persona.menu.label'] })).toBeDefined();
    expect(getTrigger().getAttribute('aria-label')).toBe(getTriggerName(FIRST_PERSONA));
  });
});

describe('PersonaSwitcher states', () => {
  afterEach(() => {
    cleanup();
  });

  it('is busy while the context is being switched, keeps the focus, stays closed, then is available again', async () => {
    const runtime = createTwoPersonaRuntime();
    const queryClient = createQueryClient({ networkMode: 'always' });
    const deferred = createDeferred();
    vi.spyOn(queryClient, 'cancelQueries').mockReturnValue(deferred.promise);

    await renderSwitcher(runtime, queryClient);
    await waitForTriggerName(FIRST_PERSONA);

    expect(getTrigger().disabled).toBe(false);
    expect(getTrigger().getAttribute('aria-busy')).toBeNull();
    expect(getAnnouncement()).toBe('');

    await openMenu();
    chooseWithEnter(getPersonaItem(SECOND_PERSONA));

    await waitFor(() => {
      expect(getTrigger().getAttribute('aria-busy')).toBe('true');
    });

    const trigger = getTrigger();

    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    expect(trigger.disabled).toBe(false);
    expect(trigger.textContent).toBe(defaultLocaleCatalog['persona.switching']);
    expect(trigger.getAttribute('aria-label')).toBe(getTriggerName(FIRST_PERSONA));
    expect(getAnnouncement()).toBe(defaultLocaleCatalog['persona.switching']);
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(screen.queryByRole('menu')).toBeNull();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    await waitForTriggerName(SECOND_PERSONA);
    await waitFor(() => {
      expect(getTrigger().getAttribute('aria-busy')).toBeNull();
    });

    expect(runtime.actingContext.get().userId).toBe(SECOND_PERSONA.userId);
    expect(getAnnouncement()).toBe(
      defaultLocaleCatalog['persona.switched'].replace('{persona}', formatOption(SECOND_PERSONA)),
    );
  });

  it('has no live region of its own', async () => {
    const runtime = createTwoPersonaRuntime();

    await renderSwitcher(runtime);
    await waitForTriggerName(FIRST_PERSONA);

    const switcherRegion = getTrigger().closest('div')?.querySelector('[role="status"]');

    expect(switcherRegion ?? null).toBeNull();
  });

  it('announces the switch and the arrival one after another', async () => {
    const runtime = createTwoPersonaRuntime();
    const queryClient = createQueryClient({ networkMode: 'always' });
    const deferred = createDeferred();
    vi.spyOn(queryClient, 'cancelQueries').mockReturnValue(deferred.promise);
    const heard: string[] = [];

    await renderSwitcher(runtime, queryClient);
    await waitForTriggerName(FIRST_PERSONA);
    const region = document.querySelector('[aria-live="polite"]');
    const observer = new MutationObserver(() => {
      const message = getAnnouncement();

      if (message !== '' && heard.at(-1) !== message) {
        heard.push(message);
      }
    });

    observer.observe(region ?? document.body, { childList: true, subtree: true });
    await openMenu();
    chooseWithEnter(getPersonaItem(SECOND_PERSONA));
    await waitFor(() => {
      expect(heard).toEqual([defaultLocaleCatalog['persona.switching']]);
    });
    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });
    await waitFor(() => {
      expect(heard).toHaveLength(2);
    });
    observer.disconnect();

    expect(heard).toEqual([
      defaultLocaleCatalog['persona.switching'],
      defaultLocaleCatalog['persona.switched'].replace('{persona}', formatOption(SECOND_PERSONA)),
    ]);
  });

  it('takes the requested focus only when the list has loaded and the trigger can be focused', async () => {
    const deferred = createDeferred();
    const runtime = createTestRuntime({
      demoControl: createDemoControl(async () => {
        await deferred.promise;

        return [FIRST_PERSONA];
      }),
    });

    await renderSwitcher(runtime, undefined, undefined, true);

    expect(getTrigger().disabled).toBe(true);
    expect(document.activeElement).toBe(document.body);

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    await waitFor(() => {
      expect(getTrigger().disabled).toBe(false);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(getTrigger());
    });
  });

  it('leaves the focus alone when nobody asked for it', async () => {
    const runtime = createTwoPersonaRuntime();

    await renderSwitcher(runtime);
    await waitForTriggerName(FIRST_PERSONA);

    expect(document.activeElement).toBe(document.body);
  });

  it('renders nothing in the pilot build without the demo control', async () => {
    const runtime = createTestRuntime();

    await renderSwitcher(runtime);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(defaultLocaleCatalog['persona.label'])).toBeNull();
    expect(document.body.textContent).toBe('');
  });

  it('puts the given class name on the trigger next to its own layout', async () => {
    const runtime = createTestRuntime({ demoControl: createDemoControl(() => Promise.resolve([FIRST_PERSONA])) });

    await renderSwitcher(runtime, undefined, 'w-80');

    const trigger = await screen.findByRole('button', { name: TRIGGER_NAME_PATTERN });

    expect(trigger.className).toContain('w-80');
    expect(trigger.className).toContain('justify-start');
  });

  it('shows a disabled trigger of the same shape while the list is loading', async () => {
    const deferred = createDeferred();
    const runtime = createTestRuntime({
      demoControl: createDemoControl(async () => {
        await deferred.promise;

        return [FIRST_PERSONA];
      }),
    });

    await renderSwitcher(runtime);

    const trigger = getTrigger();
    const loadingClassName = trigger.className;

    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute('aria-label')).toBe(defaultLocaleCatalog['persona.label']);
    expect(trigger.className).toContain('justify-start');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    expect(screen.queryByRole('menu')).toBeNull();

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    await waitFor(() => {
      expect(getTrigger().disabled).toBe(false);
    });

    expect(getTrigger().className).toBe(loadingClassName);
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
      expect(screen.queryByRole('button')).toBeNull();
      expect(log).toHaveBeenCalledWith('> PersonaSwitcher -> reportPersonasError:', { error: failure });
    });

    expect(document.body.textContent).toBe('');
  });

  it('logs the choice and keeps the context when the switch fails', async () => {
    const log = vi.spyOn(console, 'log');
    const runtime = createTwoPersonaRuntime();
    const queryClient = createQueryClient({ networkMode: 'always' });
    const failure = new Error('cancel failed');
    vi.spyOn(queryClient, 'cancelQueries').mockRejectedValue(failure);

    await renderSwitcher(runtime, queryClient);
    await waitForTriggerName(FIRST_PERSONA);
    await openMenu();
    chooseWithEnter(getPersonaItem(SECOND_PERSONA));

    await waitFor(() => {
      expect(log).toHaveBeenCalledWith('> PersonaSwitcher -> handlePersonaValueChange:', { personaId: SECOND_PERSONA.id });
      expect(log).toHaveBeenCalledWith('> usePersonaSwitch -> switchToPersona:', {
        personaId: SECOND_PERSONA.id,
        switchError: failure,
      });
    });
    await waitFor(() => {
      expect(getTrigger().getAttribute('aria-busy')).toBeNull();
    });

    expect(runtime.actingContext.get().userId).toBe(FIRST_PERSONA.userId);
    expect(getAnnouncement()).toBe(defaultLocaleCatalog['persona.switchError']);
  });

  it('announces the message of the error code when the switch fails with a coded error', async () => {
    const runtime = createTwoPersonaRuntime();
    const queryClient = createQueryClient({ networkMode: 'always' });
    vi.spyOn(queryClient, 'cancelQueries').mockRejectedValue(createCodedError());

    await renderSwitcher(runtime, queryClient);
    await waitForTriggerName(FIRST_PERSONA);
    await openMenu();
    chooseWithEnter(getPersonaItem(SECOND_PERSONA));

    await waitFor(() => {
      expect(getAnnouncement()).toBe(defaultLocaleCatalog['error.invalid_transition']);
    });
  });

  it('drops the focus request when the switch fails, so a later element with the key does not take the focus', async () => {
    const runtime = createTwoPersonaRuntime();
    const queryClient = createQueryClient({ networkMode: 'always' });
    vi.spyOn(queryClient, 'cancelQueries').mockRejectedValue(new Error('cancel failed'));

    await renderSwitcher(runtime, queryClient, undefined, false, <LateFocusTargetLauncher />);
    await waitForTriggerName(FIRST_PERSONA);
    await openMenu();
    chooseWithEnter(getPersonaItem(SECOND_PERSONA));
    await waitFor(() => {
      expect(getAnnouncement()).toBe(defaultLocaleCatalog['persona.switchError']);
    });

    fireEvent.click(screen.getByRole('button', { name: SHOW_LATE_LABEL }));

    expect(screen.getByRole('button', { name: LATE_LABEL })).toBeDefined();
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: LATE_LABEL }));
  });
});
