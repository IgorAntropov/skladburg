import type { ReactElement } from 'react';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { defaultLocaleCatalog } from 'virtual:build-profile';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { DemoPersonaListItemValue } from '@/shared/api';
import type { ViewportClassValue } from '@/shared/lib/viewport';
import type { IFakeViewport } from '@/shared/lib/viewport/index.testing';
import type { AppSectionValue } from '@/shared/routing';
import type { IMemoryLocation } from '@/shared/routing/index.testing';
import type { IThemePreferenceStore } from '@/shared/theme';

import { createTestRuntime } from '@/shared/api/index.testing';
import { installFakeViewport } from '@/shared/lib/viewport/index.testing';
import {
  APP_SECTIONS,
  SECTION_TITLE_KEYS,
} from '@/shared/routing';
import { createMemoryLocation } from '@/shared/routing/index.testing';
import { createThemePreferenceStore } from '@/shared/theme';

import type {
  GateValue,
  ProfileSessionModeValue,
} from '../../lib/testing/profileMenuHarness';

import {
  createGate,
  createProfileDemoControl,
  createProfileLocalizer,
  createProfileRoutes,
  PROFILE_ACTING_CONTEXT,
  PROFILE_CUSTOMER_PERSONA,
  PROFILE_PERSONAS,
  ProfileTreeProviders,
} from '../../lib/testing/profileMenuHarness';
import { ProfileMenu } from './ProfileMenu';

interface MenuHarnessProps {
  currentSection: AppSectionValue | undefined;
  isFirstItemFocused: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onResetRequest: () => void;
  sections: readonly AppSectionValue[];
}

interface RenderedMenuValue {
  location: IMemoryLocation;
  onOpenChange: (isOpen: boolean) => void;
  onResetRequest: () => void;
  themeStore: IThemePreferenceStore;
}

interface RenderMenuOptionsValue {
  currentSection?: AppSectionValue | undefined;
  hasDemo?: boolean;
  isFirstItemFocused?: boolean;
  personas?: readonly DemoPersonaListItemValue[];
  personasGate?: GateValue;
  sections?: readonly AppSectionValue[];
  sessionGate?: GateValue;
  sessionMode?: ProfileSessionModeValue;
  sides?: readonly ProfileKind[];
  viewportClass?: ViewportClassValue;
}

const MENU_NAME = defaultLocaleCatalog['profile.menu.label'];
const NAV_GROUP_NAME = defaultLocaleCatalog['app.nav.label'];
const THEME_GROUP_NAME = defaultLocaleCatalog['theme.label'];
const RESET_ITEM_NAME = defaultLocaleCatalog['demo.reset.menuItem'];
const CUSTOMER_ROLE_LINE = defaultLocaleCatalog['profile.role']
  .replace('{role}', PROFILE_CUSTOMER_PERSONA.roleName)
  .replace('{organization}', PROFILE_CUSTOMER_PERSONA.organizationName);

let installedViewport: IFakeViewport | undefined;

const MenuHarness = ({
  currentSection,
  isFirstItemFocused,
  onOpenChange,
  onResetRequest,
  sections,
}: MenuHarnessProps): ReactElement => {
  const [isOpen, setIsOpen] = useState(true);

  const handleOpenChange = (nextIsOpen: boolean): void => {
    onOpenChange(nextIsOpen);
    setIsOpen(nextIsOpen);
  };

  return (
    <ProfileMenu
      buttonRef={undefined}
      currentSection={currentSection}
      isFirstItemFocused={isFirstItemFocused}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      onResetRequest={onResetRequest}
      sections={sections}
    />
  );
};

const renderMenu = async ({
  currentSection = 'network',
  hasDemo = false,
  isFirstItemFocused = false,
  personas = PROFILE_PERSONAS,
  personasGate,
  sections = APP_SECTIONS,
  sessionGate,
  sessionMode,
  sides = [ProfileKind.CUSTOMER],
  viewportClass = 'desktop',
}: RenderMenuOptionsValue = {}): Promise<RenderedMenuValue> => {
  installedViewport?.restore();
  installedViewport = installFakeViewport(viewportClass);
  const localizer = await createProfileLocalizer();
  const location = createMemoryLocation(`/${currentSection}`);
  const themeStore = createThemePreferenceStore({ colorSchemeQuery: undefined, storage: undefined, storageEvents: undefined });
  const runtime = createTestRuntime({
    demoControl: hasDemo ? createProfileDemoControl({ personas, personasGate }) : undefined,
    routes: createProfileRoutes({ sessionGate, sessionMode, sides }),
  });
  runtime.actingContext.set(PROFILE_ACTING_CONTEXT);
  const onOpenChange = vi.fn();
  const onResetRequest = vi.fn();

  render(
    <ProfileTreeProviders localizer={localizer} location={location} runtime={runtime} themeStore={themeStore}>
      <MenuHarness
        currentSection={currentSection}
        isFirstItemFocused={isFirstItemFocused}
        onOpenChange={onOpenChange}
        onResetRequest={onResetRequest}
        sections={sections}
      />
    </ProfileTreeProviders>,
  );

  return { location, onOpenChange, onResetRequest, themeStore };
};

const getSectionTitle = (section: AppSectionValue): string => defaultLocaleCatalog[SECTION_TITLE_KEYS[section]];

const findMenu = (): Promise<HTMLElement> => screen.findByRole('menu', { name: MENU_NAME });

const findReadyMenu = async (): Promise<HTMLElement> => {
  const menu = await findMenu();
  await within(menu).findByTestId('profile-menu-header');

  return menu;
};

const getMenuItemNames = (menu: HTMLElement): string[] => {
  return within(menu).queryAllByRole('menuitem').map(item => item.textContent);
};

const chooseWithEnter = (item: HTMLElement): void => {
  item.focus();
  fireEvent.keyDown(item, { key: 'Enter' });
};

describe('ProfileMenu', () => {
  afterEach(() => {
    cleanup();
    installedViewport?.restore();
    installedViewport = undefined;
  });

  describe('header', () => {
    it('shows the name, the organization and the side of the organization', async () => {
      await renderMenu();
      const menu = await findReadyMenu();

      expect(within(menu).getByTestId('profile-menu-name').textContent).toBe(PROFILE_CUSTOMER_PERSONA.userDisplayName);
      expect(within(menu).getByTestId('profile-menu-role').textContent).toBe(PROFILE_CUSTOMER_PERSONA.organizationName);
      expect(within(menu).getByTestId('profile-menu-sides').textContent).toBe(defaultLocaleCatalog['side.customer']);
    });

    it('shows the big avatar with the initials of the user', async () => {
      await renderMenu();
      const menu = await findReadyMenu();

      const avatar = within(within(menu).getByTestId('profile-menu-header')).getByText('АС');

      expect(avatar.getAttribute('aria-hidden')).toBe('true');
      expect(avatar.className).toContain('size-16');
    });

    it('adds the role of the current persona in the demo', async () => {
      await renderMenu({ hasDemo: true });
      const menu = await findReadyMenu();

      await waitFor(() => {
        expect(within(menu).getByTestId('profile-menu-role').textContent).toBe(CUSTOMER_ROLE_LINE);
      });
    });

    it('shows only the organization when the persona has no role', async () => {
      const personas = [{ ...PROFILE_CUSTOMER_PERSONA, roleName: '' }];
      await renderMenu({ hasDemo: true, personas });
      const menu = await findReadyMenu();

      await waitFor(() => {
        expect(within(menu).getByTestId('profile-menu-role').textContent).toBe(PROFILE_CUSTOMER_PERSONA.organizationName);
      });
    });

    it('shows a skeleton instead of the line while the personas load', async () => {
      const personasGate = createGate();
      await renderMenu({ hasDemo: true, personasGate });
      const menu = await findReadyMenu();

      expect(within(menu).queryByTestId('profile-menu-role')).toBeNull();
      expect(within(menu).getByTestId('profile-menu-name')).toBeDefined();

      personasGate.open();

      await waitFor(() => {
        expect(within(menu).getByTestId('profile-menu-role').textContent).toBe(CUSTOMER_ROLE_LINE);
      });
    });

    it('marks every side of the organization with an icon and the name in its own colour', async () => {
      await renderMenu({ sides: [ProfileKind.SUPPLIER, ProfileKind.CARRIER] });
      const menu = await findReadyMenu();

      const sides = within(within(menu).getByTestId('profile-menu-sides')).getAllByText(/./);
      const [supplier, carrier] = sides;

      expect(sides.map(side => side.textContent)).toEqual([
        defaultLocaleCatalog['side.supplier'],
        defaultLocaleCatalog['side.carrier'],
      ]);
      expect(supplier?.className).toContain('text-side-label-supplier');
      expect(carrier?.className).toContain('text-side-label-carrier');
      expect(supplier?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(carrier?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    });

    it.each([
      [ProfileKind.CUSTOMER, 'text-side-label-customer', 'side.customer'],
      [ProfileKind.SUPPLIER, 'text-side-label-supplier', 'side.supplier'],
      [ProfileKind.CARRIER, 'text-side-label-carrier', 'side.carrier'],
    ] as const)('draws the side %s in the colour %s', async (kind, className, labelKey) => {
      await renderMenu({ sides: [kind] });
      const menu = await findReadyMenu();

      const badge = within(within(menu).getByTestId('profile-menu-sides')).getByText(defaultLocaleCatalog[labelKey]);

      expect(badge.className).toContain(className);
      expect(badge.querySelector('svg')).not.toBeNull();
    });

    it('has no side badges when the organization has no profiles', async () => {
      await renderMenu({ sides: [] });
      const menu = await findReadyMenu();

      expect(within(menu).queryByTestId('profile-menu-sides')).toBeNull();
    });

    it('shows a skeleton of the whole header while the session loads and the data after', async () => {
      const sessionGate = createGate();
      await renderMenu({ sessionGate });
      const menu = await findMenu();

      expect(within(menu).queryByTestId('profile-menu-header')).toBeNull();
      expect(within(menu).queryByTestId('profile-menu-name')).toBeNull();

      sessionGate.open();

      expect((await within(menu).findByTestId('profile-menu-name')).textContent).toBe(PROFILE_CUSTOMER_PERSONA.userDisplayName);
    });

    it('shows the user icon and tells that the profile did not load when the session fails', async () => {
      await renderMenu({ sessionMode: 'error' });
      const menu = await findMenu();

      const errorHeader = await within(menu).findByTestId('profile-menu-header-error');

      expect(errorHeader.querySelector('svg.lucide-user')).not.toBeNull();
      expect(within(errorHeader).getByText(defaultLocaleCatalog['profile.header.error'])).toBeDefined();
      expect(within(menu).queryByTestId('profile-menu-header')).toBeNull();
      expect(within(menu).queryByTestId('profile-menu-name')).toBeNull();
      expect(within(menu).queryByTestId('profile-menu-sides')).toBeNull();
    });

    it('does not show the error text while the session loads or after it loaded', async () => {
      const sessionGate = createGate();
      await renderMenu({ sessionGate });
      const menu = await findMenu();

      expect(within(menu).queryByText(defaultLocaleCatalog['profile.header.error'])).toBeNull();

      sessionGate.open();
      await within(menu).findByTestId('profile-menu-header');

      expect(within(menu).queryByText(defaultLocaleCatalog['profile.header.error'])).toBeNull();
    });

    it('is not an item of the menu and is not reachable by the keyboard', async () => {
      await renderMenu();
      const menu = await findReadyMenu();

      const header = within(menu).getByTestId('profile-menu-header');

      expect(header.closest('[role^="menuitem"]')).toBeNull();
      expect(header.querySelector('[tabindex],button,a[href]')).toBeNull();
      expect(header.getAttribute('role')).toBeNull();
    });
  });

  describe('composition', () => {
    it('is a menu named Profile with the header and the theme only outside the demo on a desktop', async () => {
      await renderMenu();
      const menu = await findReadyMenu();

      expect(within(menu).queryByRole('group', { name: NAV_GROUP_NAME })).toBeNull();
      expect(within(menu).queryByRole('menuitem', { name: RESET_ITEM_NAME })).toBeNull();
      expect(within(menu).queryByText(defaultLocaleCatalog['persona.group.fresh'])).toBeNull();
      expect(within(menu).getByText(THEME_GROUP_NAME)).toBeDefined();
      expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(3);
      expect(getMenuItemNames(menu)).toEqual([]);
    });

    it.each(['phone', 'tablet', 'desktop'] as const)('has the personas, the theme and the reset in the demo on a %s', async (viewport) => {
      await renderMenu({ hasDemo: true, viewportClass: viewport });
      const menu = await findReadyMenu();

      expect(await within(menu).findByText(defaultLocaleCatalog['persona.group.fresh'])).toBeDefined();
      expect(within(menu).getByText(defaultLocaleCatalog['persona.group.construction'])).toBeDefined();
      expect(within(menu).getByRole('group', { name: THEME_GROUP_NAME })).toBeDefined();
      expect(within(menu).getByRole('menuitem', { name: RESET_ITEM_NAME })).toBeDefined();
    });

    it('lists the sections with the current one checked on a phone', async () => {
      await renderMenu({ currentSection: 'deals', viewportClass: 'phone' });
      const menu = await findReadyMenu();

      const group = within(menu).getByRole('group', { name: NAV_GROUP_NAME });
      const items = within(group).getAllByRole('menuitemradio');
      const checkedItems = items.filter(item => item.getAttribute('aria-checked') === 'true');

      expect(items.map(item => item.textContent)).toEqual(APP_SECTIONS.map(getSectionTitle));
      expect(checkedItems.map(item => item.textContent)).toEqual([getSectionTitle('deals')]);
    });

    it('marks the current section by the checked state without a check mark', async () => {
      await renderMenu({ currentSection: 'deals', viewportClass: 'phone' });
      const menu = await findReadyMenu();

      const group = within(menu).getByRole('group', { name: NAV_GROUP_NAME });
      const current = within(group).getByRole('menuitemradio', { name: getSectionTitle('deals') });

      expect(current.getAttribute('aria-checked')).toBe('true');

      for (const item of within(group).getAllByRole('menuitemradio')) {
        expect(item.querySelector('svg')).toBeNull();
        expect(item.childElementCount).toBe(1);
        expect(item.firstElementChild?.tagName).toBe('SPAN');
        expect(item.firstElementChild?.textContent).toBe(item.textContent);
      }
    });

    it('puts the sections right after the header, before the personas and the theme', async () => {
      await renderMenu({ hasDemo: true, viewportClass: 'phone' });
      const menu = await findReadyMenu();
      await within(menu).findByText(defaultLocaleCatalog['persona.group.fresh']);

      const navGroup = within(menu).getByRole('group', { name: NAV_GROUP_NAME });
      const header = within(menu).getByTestId('profile-menu-header');
      const personasLabel = within(menu).getByText(defaultLocaleCatalog['persona.group.fresh']);
      const themeGroup = within(menu).getByRole('group', { name: THEME_GROUP_NAME });

      expect(header.compareDocumentPosition(navGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(navGroup.compareDocumentPosition(personasLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(personasLabel.compareDocumentPosition(themeGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it.each(['tablet', 'desktop'] as const)('has no sections on a %s', async (viewportClass) => {
      await renderMenu({ viewportClass });
      const menu = await findReadyMenu();

      expect(within(menu).queryByRole('group', { name: NAV_GROUP_NAME })).toBeNull();
    });

    it('has no sections on a phone when there are none to show', async () => {
      await renderMenu({ sections: [], viewportClass: 'phone' });
      const menu = await findReadyMenu();

      expect(within(menu).queryByRole('group', { name: NAV_GROUP_NAME })).toBeNull();
    });

    it('has no separator twice in a row', async () => {
      await renderMenu({ hasDemo: true, viewportClass: 'phone' });
      const menu = await findReadyMenu();
      await within(menu).findByText(defaultLocaleCatalog['persona.group.fresh']);

      const separators = within(menu).getAllByRole('separator');
      const hasNeighbours = separators.some(separator => separator.nextElementSibling?.getAttribute('role') === 'separator');

      expect(separators).toHaveLength(4);
      expect(hasNeighbours).toBe(false);
    });
  });

  describe('scrolling part and footer', () => {
    interface MenuStructureValue {
      footer: HTMLElement;
      menu: HTMLElement;
      scroll: HTMLElement | null;
    }

    const readStructure = async (options: RenderMenuOptionsValue): Promise<MenuStructureValue> => {
      await renderMenu(options);
      const menu = await findReadyMenu();

      return {
        footer: within(menu).getByTestId('profile-menu-footer'),
        menu,
        scroll: within(menu).queryByTestId('profile-menu-scroll'),
      };
    };

    it('scrolls only the personas and keeps the header and the footer outside of the scroll', async () => {
      const { footer, menu, scroll } = await readStructure({ hasDemo: true });
      await within(menu).findByText(defaultLocaleCatalog['persona.group.fresh']);

      const header = within(menu).getByTestId('profile-menu-header');

      expect(scroll).not.toBeNull();
      expect(scroll?.className).toContain('overflow-y-auto');
      expect(scroll?.className).toContain('min-h-0');
      expect(scroll?.contains(within(menu).getByText(defaultLocaleCatalog['persona.group.fresh']))).toBe(true);
      expect(scroll?.contains(within(menu).getByText(defaultLocaleCatalog['persona.group.construction']))).toBe(true);
      expect(scroll?.contains(header)).toBe(false);
      expect(scroll?.contains(footer)).toBe(false);
      expect(footer.contains(header)).toBe(false);
      expect(footer.className).not.toContain('overflow');
    });

    it('limits the height of the menu to the height available on the screen', async () => {
      const { menu } = await readStructure({ hasDemo: true });

      const root = within(menu).getByTestId('profile-menu-scroll').parentElement;

      expect(root?.className).toContain('--radix-dropdown-menu-content-available-height');
      expect(root?.className).toContain('flex-col');
    });

    it('keeps the theme and the reset in the footer, after the personas', async () => {
      const { footer, menu, scroll } = await readStructure({ hasDemo: true });
      await within(menu).findByText(defaultLocaleCatalog['persona.group.fresh']);

      expect(within(footer).getByText(THEME_GROUP_NAME)).toBeDefined();
      expect(within(footer).getByRole('group', { name: THEME_GROUP_NAME })).toBeDefined();
      expect(within(footer).getByRole('menuitem', { name: RESET_ITEM_NAME })).toBeDefined();
      expect(scroll?.compareDocumentPosition(footer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('keeps the sections of a phone in the scrolling part', async () => {
      const { menu, scroll } = await readStructure({ hasDemo: true, viewportClass: 'phone' });
      await within(menu).findByText(defaultLocaleCatalog['persona.group.fresh']);

      expect(scroll?.contains(within(menu).getByRole('group', { name: NAV_GROUP_NAME }))).toBe(true);
    });

    it('has no scrolling part when there is nothing to scroll', async () => {
      const { footer, menu, scroll } = await readStructure({});

      expect(scroll).toBeNull();
      expect(within(footer).getByRole('group', { name: THEME_GROUP_NAME })).toBeDefined();
      expect(within(menu).getAllByRole('separator')).toHaveLength(1);
    });

    it('has no reset item in the footer outside the demo', async () => {
      const { footer } = await readStructure({});

      expect(within(footer).queryByRole('menuitem')).toBeNull();
    });

    it('walks over the items through the blocks with the arrow keys, Home and End', async () => {
      const { footer, menu, scroll } = await readStructure({ hasDemo: true });
      await within(menu).findByText(defaultLocaleCatalog['persona.group.fresh']);
      const personas = within(scroll ?? menu).getAllByRole('menuitemradio');
      const lastPersona = personas.at(-1);
      const firstPersona = personas[0];
      const firstTheme = within(footer).getAllByRole('menuitemradio')[0];
      const reset = within(footer).getByRole('menuitem', { name: RESET_ITEM_NAME });

      lastPersona?.focus();
      fireEvent.keyDown(lastPersona ?? menu, { key: 'ArrowDown' });

      await waitFor(() => {
        expect(document.activeElement).toBe(firstTheme);
      });

      fireEvent.keyDown(firstTheme ?? menu, { key: 'ArrowUp' });

      await waitFor(() => {
        expect(document.activeElement).toBe(lastPersona);
      });

      fireEvent.keyDown(menu, { key: 'End' });

      await waitFor(() => {
        expect(document.activeElement).toBe(reset);
      });

      fireEvent.keyDown(menu, { key: 'Home' });

      await waitFor(() => {
        expect(document.activeElement).toBe(firstPersona);
      });
    });

    it('finds a persona by the first letters of the name from the footer', async () => {
      const { footer, menu } = await readStructure({ hasDemo: true });
      await within(menu).findByText(defaultLocaleCatalog['persona.group.fresh']);
      const reset = within(footer).getByRole('menuitem', { name: RESET_ITEM_NAME });
      reset.focus();

      fireEvent.keyDown(reset, { key: 'С' });

      await waitFor(() => {
        expect(document.activeElement?.textContent).toContain('Сергей Кузнецов');
      });
    });
  });

  describe('actions', () => {
    it('goes to the chosen section on a phone and closes the menu', async () => {
      const { location, onOpenChange } = await renderMenu({ viewportClass: 'phone' });
      const menu = await findReadyMenu();

      chooseWithEnter(within(menu).getByRole('menuitemradio', { name: getSectionTitle('catalog') }));

      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBeNull();
      });
      expect(location.history).toEqual(['/network', '/catalog']);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('stays where it is when the current section is chosen', async () => {
      const { location } = await renderMenu({ viewportClass: 'phone' });
      const menu = await findReadyMenu();

      chooseWithEnter(within(menu).getByRole('menuitemradio', { name: getSectionTitle('network') }));

      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBeNull();
      });
      expect(location.history).toEqual(['/network']);
    });

    it('changes nothing with the arrow keys, only the highlight moves', async () => {
      const { location, themeStore } = await renderMenu({ hasDemo: true, viewportClass: 'phone' });
      const menu = await findReadyMenu();
      await within(menu).findByText(defaultLocaleCatalog['persona.group.fresh']);

      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      fireEvent.keyDown(menu, { key: 'ArrowUp' });
      fireEvent.keyDown(menu, { key: 'End' });
      fireEvent.keyDown(menu, { key: 'Home' });

      expect(screen.getByRole('menu')).toBeDefined();
      expect(location.history).toEqual(['/network']);
      expect(themeStore.getPreference()).toBe('light');
    });

    it('changes the theme by the chosen item', async () => {
      const { themeStore } = await renderMenu();
      const menu = await findReadyMenu();
      const group = within(menu).getByRole('group', { name: THEME_GROUP_NAME });

      chooseWithEnter(within(group).getByRole('menuitemradio', { name: defaultLocaleCatalog['theme.dark'] }));

      expect(themeStore.getPreference()).toBe('dark');
    });

    it('asks the owner to reset the demo and closes the menu', async () => {
      const { onOpenChange, onResetRequest } = await renderMenu({ hasDemo: true });
      const menu = await findReadyMenu();

      chooseWithEnter(within(menu).getByRole('menuitem', { name: RESET_ITEM_NAME }));

      expect(onResetRequest).toHaveBeenCalledOnce();
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('focus', () => {
    it('puts the focus on the first section of a phone when it opens by the launch', async () => {
      await renderMenu({ isFirstItemFocused: true, viewportClass: 'phone' });
      const menu = await findReadyMenu();

      await waitFor(() => {
        expect(document.activeElement).toBe(within(menu).getAllByRole('menuitemradio')[0]);
      });
      expect(document.activeElement?.textContent).toBe(getSectionTitle('network'));
    });

    it('puts the focus on the first item of the theme when there is nothing before it', async () => {
      await renderMenu({ isFirstItemFocused: true });
      const menu = await findReadyMenu();

      await waitFor(() => {
        expect(document.activeElement).toBe(within(menu).getAllByRole('menuitemradio')[0]);
      });
      expect(document.activeElement?.textContent).toBe(defaultLocaleCatalog['theme.light']);
    });
  });
});
