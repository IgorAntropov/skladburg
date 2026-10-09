import type { ReactElement } from 'react';

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
import { Fragment } from 'react';
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

import {
  ApiRuntimeProvider,
  createQueryClient,
  DemoPersonaKind,
  useActingContext,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import {
  createLocalizer,
  LocalizerProvider,
} from '@/shared/i18n';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  FocusHandoffProvider,
  LiveRegionProvider,
  useFocusHandoff,
} from '@/shared/ui';

import { PersonaMenuRadioGroup } from './PersonaMenuRadioGroup';

const FOCUS_KEY = 'top-bar-menu';
const MENU_LABEL = 'Settings';
const MENU_BUTTON_NAME = 'Menu';

const FIRST_PERSONA: DemoPersonaListItemValue = {
  id: 'f9000001-0000-4000-8000-000000000000',
  kind: DemoPersonaKind.BUYER,
  organizationId: 'f0000001-0000-4000-8000-000000000000',
  organizationName: 'Север-Опт',
  userId: 'f0000002-0000-4000-8000-000000000000',
};
const SECOND_PERSONA: DemoPersonaListItemValue = {
  id: 'f9000002-0000-4000-8000-000000000000',
  kind: DemoPersonaKind.SELLER,
  organizationId: 'f0000003-0000-4000-8000-000000000000',
  organizationName: 'Юг-Трейд',
  userId: 'f9200002-0000-4000-8000-000000000000',
};

const formatOption = (persona: DemoPersonaListItemValue, kindKey: 'persona.kind.buyer' | 'persona.kind.seller'): string => {
  return defaultLocaleCatalog['persona.option']
    .replace('{kind}', defaultLocaleCatalog[kindKey])
    .replace('{organization}', persona.organizationName);
};

const FIRST_OPTION = formatOption(FIRST_PERSONA, 'persona.kind.buyer');
const SECOND_OPTION = formatOption(SECOND_PERSONA, 'persona.kind.seller');

const createDemoControl = (listPersonas: IDemoControl['listPersonas']): IDemoControl => ({
  listPersonas,
  onReset: () => () => undefined,
  onStatus: () => () => undefined,
  reset: () => Promise.resolve(),
});

const Boundary = ({ children }: { children: ReactElement }): ReactElement => {
  const { organizationId, userId } = useActingContext();

  return <Fragment key={`${organizationId ?? ''}:${userId ?? ''}`}>{children}</Fragment>;
};

const Menu = (): ReactElement => {
  const { ref } = useFocusHandoff<HTMLButtonElement>(FOCUS_KEY);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button ref={ref}>{MENU_BUTTON_NAME}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent label={MENU_LABEL}>
        <PersonaMenuRadioGroup focusKey={FOCUS_KEY} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const getAnnouncement = (): string => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

const renderMenu = async (
  runtime: ApiRuntimeValue,
  queryClient: QueryClient = createQueryClient({ networkMode: 'always' }),
): Promise<void> => {
  const localizer = await createLocalizer({
    bundledLocales: ['ru'],
    catalogLoaders: { ru: () => Promise.resolve(defaultLocaleCatalog) },
    requestedLocale: undefined,
    tenant: { availableLocales: ['ru'], defaultLocale: 'ru', termOverrides: {} },
    userTimeZone: 'UTC',
  });

  render(
    <LocalizerProvider localizer={localizer}>
      <ApiRuntimeProvider runtime={runtime}>
        <QueryClientProvider client={queryClient}>
          <LiveRegionProvider>
            <FocusHandoffProvider>
              <Boundary>
                <Menu />
              </Boundary>
            </FocusHandoffProvider>
          </LiveRegionProvider>
        </QueryClientProvider>
      </ApiRuntimeProvider>
    </LocalizerProvider>,
  );
};

const listBothPersonas: IDemoControl['listPersonas'] = () => Promise.resolve([FIRST_PERSONA, SECOND_PERSONA]);

const createRuntime = (listPersonas: IDemoControl['listPersonas'] = listBothPersonas): ApiRuntimeValue => {
  const runtime = createTestRuntime({ demoControl: createDemoControl(listPersonas) });

  runtime.actingContext.set({ organizationId: FIRST_PERSONA.organizationId, userId: FIRST_PERSONA.userId });

  return runtime;
};

const openMenu = async (): Promise<HTMLElement> => {
  const trigger = screen.getByRole('button', { name: MENU_BUTTON_NAME });

  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });

  return screen.findByRole('menu');
};

const getOption = async (name: string): Promise<HTMLElement> => screen.findByRole('menuitemradio', { name });

describe('PersonaMenuRadioGroup', () => {
  afterEach(() => {
    cleanup();
  });

  it('lists the personas with the current one checked and a heading', async () => {
    await renderMenu(createRuntime());
    await openMenu();

    const first = await getOption(FIRST_OPTION);
    const second = await getOption(SECOND_OPTION);

    expect(first.getAttribute('aria-checked')).toBe('true');
    expect(second.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(defaultLocaleCatalog['persona.label'])).toBeDefined();
    expect(screen.getByRole('group', { name: defaultLocaleCatalog['persona.menu.label'] })).toBeDefined();
  });

  it('does not switch the persona with the arrow keys', async () => {
    const runtime = createRuntime();
    await renderMenu(runtime);
    const menu = await openMenu();
    await getOption(FIRST_OPTION);

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowUp' });

    expect(runtime.actingContext.get().userId).toBe(FIRST_PERSONA.userId);
  });

  it('switches on the chosen item, closes the menu and announces the switch and the arrival', async () => {
    const runtime = createRuntime();
    await renderMenu(runtime);
    await openMenu();
    const second = await getOption(SECOND_OPTION);

    second.focus();
    fireEvent.keyDown(second, { key: 'Enter' });

    await waitFor(() => {
      expect(runtime.actingContext.get().userId).toBe(SECOND_PERSONA.userId);
    });
    await waitFor(() => {
      expect(getAnnouncement()).toBe(defaultLocaleCatalog['persona.switched'].replace('{persona}', SECOND_OPTION));
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('gives the focus to the element of the new tree that carries the same key', async () => {
    const runtime = createRuntime();
    await renderMenu(runtime);
    const previousButton = screen.getByRole('button', { name: MENU_BUTTON_NAME });
    await openMenu();
    const second = await getOption(SECOND_OPTION);

    second.focus();
    fireEvent.keyDown(second, { key: 'Enter' });

    await waitFor(() => {
      expect(runtime.actingContext.get().userId).toBe(SECOND_PERSONA.userId);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: MENU_BUTTON_NAME }));
    });
    expect(document.activeElement).not.toBe(previousButton);
  });

  it('does nothing when the current persona is chosen again', async () => {
    const queryClient = createQueryClient({ networkMode: 'always' });
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');
    const runtime = createRuntime();
    await renderMenu(runtime, queryClient);
    await openMenu();
    const first = await getOption(FIRST_OPTION);

    first.focus();
    fireEvent.keyDown(first, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(cancelQueries).not.toHaveBeenCalled();
    expect(getAnnouncement()).toBe('');
  });

  it('announces the switch while the context is being switched and the arrival after it', async () => {
    const queryClient = createQueryClient({ networkMode: 'always' });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(queryClient, 'cancelQueries').mockReturnValue(gate);
    const runtime = createRuntime();
    await renderMenu(runtime, queryClient);
    await openMenu();
    const second = await getOption(SECOND_OPTION);

    second.focus();
    fireEvent.keyDown(second, { key: 'Enter' });

    await waitFor(() => {
      expect(getAnnouncement()).toBe(defaultLocaleCatalog['persona.switching']);
    });

    await act(async () => {
      release();
      await gate;
    });
    await waitFor(() => {
      expect(runtime.actingContext.get().userId).toBe(SECOND_PERSONA.userId);
    });
    await waitFor(() => {
      expect(getAnnouncement()).toBe(defaultLocaleCatalog['persona.switched'].replace('{persona}', SECOND_OPTION));
    });
  });

  it('shows nothing outside the demo', async () => {
    const runtime = createTestRuntime();
    await renderMenu(runtime);
    await openMenu();

    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(screen.queryByText(defaultLocaleCatalog['persona.label'])).toBeNull();
  });

  it('shows nothing when the list cannot be loaded', async () => {
    const runtime = createRuntime(() => Promise.reject(new Error('list failed')));
    await renderMenu(runtime, new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    await openMenu();

    await waitFor(() => {
      expect(screen.queryByText(defaultLocaleCatalog['persona.label'])).toBeNull();
    });
    expect(screen.queryByRole('menuitemradio')).toBeNull();
  });
});
