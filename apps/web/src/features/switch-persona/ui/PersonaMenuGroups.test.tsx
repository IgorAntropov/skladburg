import type { ReactElement } from 'react';

import { QueryClient } from '@tanstack/react-query';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
  createQueryClient,
  useActingContext,
} from '@/shared/api';
import { createTestRuntime } from '@/shared/api/index.testing';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  useFocusHandoff,
} from '@/shared/ui';

import {
  CONSTRUCTION_BUYER_FIXTURE,
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
import { PersonaMenuGroups } from './PersonaMenuGroups';

const FOCUS_KEY = 'profile-menu';
const MENU_LABEL = 'Profile';
const MENU_BUTTON_NAME = 'Menu';
const FRESH_GROUP_TITLE = defaultLocaleCatalog['persona.group.fresh'];
const CONSTRUCTION_GROUP_TITLE = defaultLocaleCatalog['persona.group.construction'];

const formatOption = (persona: DemoPersonaListItemValue): string => {
  return defaultLocaleCatalog['persona.option']
    .replace('{name}', persona.userDisplayName)
    .replace('{role}', persona.roleName)
    .replace('{organization}', persona.organizationName);
};

const formatSwitched = (persona: DemoPersonaListItemValue): string => {
  return defaultLocaleCatalog['persona.switched'].replace('{persona}', formatOption(persona));
};

const formatGroupLabel = (groupTitle: string): string => defaultLocaleCatalog['persona.group.label'].replace('{group}', groupTitle);

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
        <PersonaMenuGroups focusKey={FOCUS_KEY} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const getAnnouncement = (): string => document.querySelector('[aria-live="polite"]')?.textContent ?? '';

const renderMenu = async (
  runtime: ApiRuntimeValue,
  queryClient: QueryClient = createQueryClient({ networkMode: 'always' }),
): Promise<void> => {
  const localizer = await createPersonaTestLocalizer();

  render(
    <PersonaProviders localizer={localizer} queryClient={queryClient} runtime={runtime}>
      <Boundary>
        <Menu />
      </Boundary>
    </PersonaProviders>,
  );
};

const listAllPersonas: IDemoControl['listPersonas'] = () => Promise.resolve(PERSONA_FIXTURES);

const createRuntime = (
  listPersonas: IDemoControl['listPersonas'] = listAllPersonas,
  current: DemoPersonaListItemValue = FRESH_BUYER_FIXTURE,
): ApiRuntimeValue => {
  const runtime = createTestRuntime({ demoControl: createPersonaDemoControl(listPersonas) });

  setActingPersona(runtime, current);

  return runtime;
};

const openMenu = async (): Promise<HTMLElement> => {
  const trigger = screen.getByRole('button', { name: MENU_BUTTON_NAME });

  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });

  return screen.findByRole('menu');
};

const getOption = async (persona: DemoPersonaListItemValue): Promise<HTMLElement> => {
  return screen.findByRole('menuitemradio', { name: formatOption(persona) });
};

describe('PersonaMenuGroups', () => {
  afterEach(() => {
    cleanup();
  });

  it('lists the personas in two groups of four with the group titles', async () => {
    await renderMenu(createRuntime());
    await openMenu();
    await getOption(FRESH_BUYER_FIXTURE);

    const freshGroup = screen.getByRole('group', { name: formatGroupLabel(FRESH_GROUP_TITLE) });
    const constructionGroup = screen.getByRole('group', { name: formatGroupLabel(CONSTRUCTION_GROUP_TITLE) });

    expect(screen.getByText(FRESH_GROUP_TITLE)).toBeDefined();
    expect(screen.getByText(CONSTRUCTION_GROUP_TITLE)).toBeDefined();
    expect(within(freshGroup).getAllByRole('menuitemradio')).toHaveLength(4);
    expect(within(constructionGroup).getAllByRole('menuitemradio')).toHaveLength(4);
    expect(within(freshGroup).getByRole('menuitemradio', { name: formatOption(FRESH_SELLER_FIXTURE) })).toBeDefined();
    expect(within(constructionGroup).getByRole('menuitemradio', { name: formatOption(CONSTRUCTION_BUYER_FIXTURE) })).toBeDefined();
  });

  it('checks exactly one item, the current persona, even when it is in the second group', async () => {
    await renderMenu(createRuntime(listAllPersonas, CONSTRUCTION_BUYER_FIXTURE));
    await openMenu();
    await getOption(CONSTRUCTION_BUYER_FIXTURE);

    const checked = screen.getAllByRole('menuitemradio').filter(item => item.getAttribute('aria-checked') === 'true');

    expect(checked).toHaveLength(1);
    expect(checked[0]?.getAttribute('aria-label')).toBe(formatOption(CONSTRUCTION_BUYER_FIXTURE));
  });

  it('marks the current persona by the ring of the avatar and draws no check', async () => {
    await renderMenu(createRuntime(listAllPersonas, CONSTRUCTION_BUYER_FIXTURE));
    await openMenu();

    const current = await getOption(CONSTRUCTION_BUYER_FIXTURE);
    const avatar = current.firstElementChild;

    expect(current.getAttribute('aria-checked')).toBe('true');
    expect(current.querySelector('svg')).toBeNull();
    expect(current.childElementCount).toBe(2);
    expect(avatar?.getAttribute('class')).toContain('in-aria-checked:ring-indicator');
  });

  it('names an item by the persona option and shows the name and the role with the organization on two lines', async () => {
    await renderMenu(createRuntime());
    await openMenu();
    const item = await getOption(FRESH_BUYER_FIXTURE);

    expect(item.getAttribute('aria-label')).toBe('Анна Смирнова, Администратор · Покупатель 1');
    expect(within(item).getByText('Анна Смирнова')).toBeDefined();
    expect(within(item).getByText('Администратор · Покупатель 1')).toBeDefined();
    expect(within(item).getByText('АС')).toBeDefined();
  });

  it('shows only the organization on the second line and drops the role from the name when the role is unknown', async () => {
    const withoutRole: DemoPersonaListItemValue = { ...FRESH_SELLER_FIXTURE, roleName: '' };
    await renderMenu(createRuntime(() => Promise.resolve([FRESH_BUYER_FIXTURE, withoutRole])));
    await openMenu();
    const item = await screen.findByRole('menuitemradio', {
      name: defaultLocaleCatalog['persona.optionWithoutRole']
        .replace('{name}', withoutRole.userDisplayName)
        .replace('{organization}', withoutRole.organizationName),
    });

    expect(within(item).getByText(withoutRole.organizationName)).toBeDefined();
  });

  it('does not switch the persona with the arrow keys', async () => {
    const runtime = createRuntime();
    await renderMenu(runtime);
    await openMenu();
    const first = await getOption(FRESH_BUYER_FIXTURE);

    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });

    expect(runtime.actingContext.get().userId).toBe(FRESH_BUYER_FIXTURE.userId);
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('switches on Enter of the chosen item, closes the menu and announces the switch and the arrival', async () => {
    const runtime = createRuntime();
    await renderMenu(runtime);
    await openMenu();
    const target = await getOption(CONSTRUCTION_BUYER_FIXTURE);

    target.focus();
    fireEvent.keyDown(target, { key: 'Enter' });

    await waitFor(() => {
      expect(runtime.actingContext.get().userId).toBe(CONSTRUCTION_BUYER_FIXTURE.userId);
    });
    await waitFor(() => {
      expect(getAnnouncement()).toBe(formatSwitched(CONSTRUCTION_BUYER_FIXTURE));
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('gives the focus to the element of the new tree that carries the same key', async () => {
    const runtime = createRuntime();
    await renderMenu(runtime);
    const previousButton = screen.getByRole('button', { name: MENU_BUTTON_NAME });
    await openMenu();
    const target = await getOption(FRESH_SELLER_FIXTURE);

    target.focus();
    fireEvent.keyDown(target, { key: 'Enter' });

    await waitFor(() => {
      expect(runtime.actingContext.get().userId).toBe(FRESH_SELLER_FIXTURE.userId);
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: MENU_BUTTON_NAME }));
    });
    expect(document.activeElement).not.toBe(previousButton);
  });

  it('does nothing when the current persona is chosen again', async () => {
    const queryClient = createQueryClient({ networkMode: 'always' });
    const cancelQueries = vi.spyOn(queryClient, 'cancelQueries');
    await renderMenu(createRuntime(), queryClient);
    await openMenu();
    const current = await getOption(FRESH_BUYER_FIXTURE);

    current.focus();
    fireEvent.keyDown(current, { key: 'Enter' });

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
    const target = await getOption(FRESH_SELLER_FIXTURE);

    target.focus();
    fireEvent.keyDown(target, { key: 'Enter' });

    await waitFor(() => {
      expect(getAnnouncement()).toBe(defaultLocaleCatalog['persona.switching']);
    });

    await act(async () => {
      release();
      await gate;
    });
    await waitFor(() => {
      expect(runtime.actingContext.get().userId).toBe(FRESH_SELLER_FIXTURE.userId);
    });
    await waitFor(() => {
      expect(getAnnouncement()).toBe(formatSwitched(FRESH_SELLER_FIXTURE));
    });
  });

  it('shows a loading skeleton and no persona items while the list is loading', async () => {
    await renderMenu(createRuntime(() => new Promise(() => undefined)));
    await openMenu();

    const skeleton = await screen.findByRole('status', { name: defaultLocaleCatalog['persona.loading'] });

    expect(skeleton.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('offers a retry item with the failure announced, and the item asks for the list again', async () => {
    const listPersonas = vi.fn<IDemoControl['listPersonas']>()
      .mockRejectedValueOnce(new Error('list failed'))
      .mockResolvedValue(PERSONA_FIXTURES);
    await renderMenu(createRuntime(listPersonas), new QueryClient({ defaultOptions: { queries: { retry: false } } }));
    await openMenu();

    const retry = await screen.findByRole('menuitem', { name: defaultLocaleCatalog['persona.loadError.retry'] });

    await waitFor(() => {
      expect(getAnnouncement()).toBe(defaultLocaleCatalog['persona.loadError.status']);
    });
    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(listPersonas).toHaveBeenCalledTimes(1);

    retry.focus();
    fireEvent.keyDown(retry, { key: 'Enter' });

    await waitFor(() => {
      expect(listPersonas).toHaveBeenCalledTimes(2);
    });
  });

  it('shows nothing outside the demo', async () => {
    await renderMenu(createTestRuntime());
    await openMenu();

    expect(screen.queryByRole('menuitemradio')).toBeNull();
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.queryByRole('status', { name: defaultLocaleCatalog['persona.loading'] })).toBeNull();
    expect(screen.queryByText(FRESH_GROUP_TITLE)).toBeNull();
  });

  it('renders null outside the demo', async () => {
    const localizer = await createPersonaTestLocalizer();
    render(
      <PersonaProviders localizer={localizer} queryClient={createQueryClient({ networkMode: 'always' })} runtime={createTestRuntime()}>
        <div data-testid="host">
          <PersonaMenuGroups focusKey={FOCUS_KEY} />
        </div>
      </PersonaProviders>,
    );

    expect(screen.getByTestId('host').innerHTML).toBe('');
  });
});
