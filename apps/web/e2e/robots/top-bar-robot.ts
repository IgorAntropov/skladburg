import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type { PersonaValue } from '../fixtures/demoData.ts';
import type { SectionValue } from '../fixtures/routes.ts';
import type { TopBarLayoutValue } from '../fixtures/viewports.ts';

import { PERSONA_COUNT } from '../fixtures/demoData.ts';
import { getText } from '../fixtures/messages.ts';
import {
  BLUR_ACTIVE_ELEMENT,
  createReadTokenColorScript,
  DISPATCH_RUSSIAN_LAYOUT_SLASH,
  READ_HORIZONTAL_OVERFLOW,
  READ_IS_FOCUS_ON_BODY,
} from '../fixtures/pageScripts.ts';
import { getPersonaLabel } from '../fixtures/personaLabels.ts';
import { getSectionTitle } from '../fixtures/routes.ts';

export type ThemePreferenceValue = 'dark' | 'light' | 'system';

const THEME_LABEL_KEYS = {
  dark: 'theme.dark',
  light: 'theme.light',
  system: 'theme.system',
} as const satisfies Record<ThemePreferenceValue, 'theme.dark' | 'theme.light' | 'theme.system'>;

const PHONE_MENU_CHUNK_PATTERN = /\/PhoneMenu-[^/]+\.js$/;

const getThemeLabel = (theme: ThemePreferenceValue): string => getText(THEME_LABEL_KEYS[theme]);

export interface TopBarRobotValue {
  blurActiveElement: () => Promise<void>;
  cancelResetConfirm: () => Promise<void>;
  closeMenuWithEscape: () => Promise<void>;
  closeResetConfirmWithEscape: () => Promise<void>;
  closeSearchWithEscape: () => Promise<void>;
  expectBannerShown: () => Promise<void>;
  expectBrand: (organizationName: string) => Promise<void>;
  expectCurrentSection: (section: SectionValue) => Promise<void>;
  expectDocumentTheme: (theme: 'dark' | 'light') => Promise<void>;
  expectFocusNotOnBody: () => Promise<void>;
  expectFocusOnKnownElement: (section: SectionValue) => Promise<void>;
  expectFocusOnMenuButton: () => Promise<void>;
  expectFocusOnResetOpener: () => Promise<void>;
  expectFocusOnSearchField: () => Promise<void>;
  expectFocusOnSearchToggle: () => Promise<void>;
  expectMenuChunkRequestCount: (count: number) => Promise<void>;
  expectMenuClosed: () => Promise<void>;
  expectMenuOpen: () => Promise<void>;
  expectNoHorizontalScroll: () => Promise<void>;
  expectPanelBackgroundFromTheme: () => Promise<string>;
  expectPersonaSwitcher: (currentPersona: PersonaValue) => Promise<void>;
  expectResetAnnounced: () => Promise<void>;
  expectResetButtonExpanded: (isExpanded: boolean) => Promise<void>;
  expectResetConfirmClosed: () => Promise<void>;
  expectResetConfirmFocusedOnCancel: () => Promise<void>;
  expectResetConfirmOpen: () => Promise<void>;
  expectResetNotAnnounced: () => Promise<void>;
  expectSearchAvailable: () => Promise<void>;
  expectSearchEmpty: () => Promise<void>;
  expectSearchFolded: () => Promise<void>;
  expectSearchNoteHidden: () => Promise<void>;
  expectSearchUnavailableNote: () => Promise<void>;
  expectSearchValue: (value: string) => Promise<void>;
  expectSections: (sections: readonly SectionValue[]) => Promise<void>;
  expectThemeChecked: (theme: ThemePreferenceValue) => Promise<void>;
  expectThemeControl: () => Promise<void>;
  focusKnownElement: (section: SectionValue) => Promise<void>;
  focusThemeOption: (theme: ThemePreferenceValue) => Promise<void>;
  openMenu: () => Promise<void>;
  openSearchWithToggle: () => Promise<void>;
  pressArrowOnTheme: (key: 'ArrowLeft' | 'ArrowRight') => Promise<void>;
  pressEnterInSearch: () => Promise<void>;
  pressSlash: () => Promise<void>;
  pressSlashOfRussianLayout: () => Promise<void>;
  requestReset: () => Promise<void>;
  resetFromConfirm: () => Promise<void>;
  selectMenuPersona: (persona: PersonaValue) => Promise<void>;
  selectMenuSection: (section: SectionValue) => Promise<void>;
  selectTheme: (theme: ThemePreferenceValue) => Promise<void>;
  typeInSearch: (text: string) => Promise<void>;
}

export const createTopBarRobot = (page: Page, layout: TopBarLayoutValue): TopBarRobotValue => {
  const isDesktop = layout === 'desktop';
  const isPhone = layout === 'phone';
  const menuChunkRequests: string[] = [];

  page.on('request', (request) => {
    if (PHONE_MENU_CHUNK_PATTERN.test(new URL(request.url()).pathname)) {
      menuChunkRequests.push(request.url());
    }
  });

  const banner = page.getByRole('banner');
  const navigation = banner.getByRole('navigation', { name: getText('app.nav.label') });
  const searchField = banner.getByRole('searchbox', { name: getText('search.label') });
  const foldedSearchField = banner.getByRole('searchbox', { includeHidden: true, name: getText('search.label') });
  const searchToggle = banner.getByRole('button', { name: getText('search.open') });
  const searchNote = banner.getByRole('status').filter({ hasText: getText('search.unavailable') });
  const menuButton = page.getByRole('button', { exact: true, includeHidden: true, name: getText('menu.open') });
  const menu = page.getByRole('menu', { name: getText('menu.label') });
  const barThemeGroup = banner.getByRole('group', { exact: true, name: getText('theme.label') });
  const barPersonaTrigger = banner.getByRole('button', { name: getText('persona.trigger.label').replace('{persona}', '') });
  const resetButton = banner.getByRole('button', { exact: true, name: getText('demo.reset.label') });
  const resetConfirm = page.getByRole('group', { name: getText('demo.reset.confirm.prompt') });
  const cancelResetButton = resetConfirm.getByRole('button', { exact: true, name: getText('demo.reset.confirm.cancel') });
  const acceptResetButton = resetConfirm.getByRole('button', { exact: true, name: getText('demo.reset.confirm.accept') });
  const resetAnnouncement = page.getByRole('status').filter({ hasText: getText('demo.reset.done') });

  const resetOpener = isDesktop ? resetButton : menuButton;

  const getKnownElement = (section: SectionValue): Locator => {
    if (isPhone) {
      return menuButton;
    }

    return navigation.getByRole('link', { exact: true, name: getSectionTitle(section) });
  };

  const getMenuGroup = (name: string): Locator => menu.getByRole('group', { exact: true, name });

  const getMenuItem = (role: 'menuitem' | 'menuitemradio', name: string): Locator => menu.getByRole(role, {
    exact: true,
    name,
  });

  const getBarThemeLabel = (theme: ThemePreferenceValue): Locator => barThemeGroup
    .locator('label')
    .filter({ hasText: getThemeLabel(theme) });

  const getBarThemeRadio = (theme: ThemePreferenceValue): Locator => barThemeGroup.getByRole('radio', {
    exact: true,
    name: getThemeLabel(theme),
  });

  const readTokenColor = (tokenName: string): Promise<string> => page.evaluate<string>(createReadTokenColorScript(tokenName));

  const expectMenuOpen = async (): Promise<void> => {
    await expect(menu).toBeVisible();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
  };

  const expectMenuClosed = async (): Promise<void> => {
    await expect(menu).toHaveCount(0);
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  };

  const openMenu = async (): Promise<void> => {
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expectMenuOpen();
  };

  const closeMenuWithEscape = async (): Promise<void> => {
    await page.keyboard.press('Escape');
    await expectMenuClosed();
    await expect(menuButton).toBeFocused();
  };

  const chooseInMenu = async (role: 'menuitem' | 'menuitemradio', name: string): Promise<void> => {
    await openMenu();
    await getMenuItem(role, name).click();
    await expect(menu).toHaveCount(0);
  };

  const expectMenuRadioChecked = async (groupName: string, itemName: string): Promise<void> => {
    await openMenu();
    await expect(getMenuGroup(groupName).getByRole('menuitemradio', { checked: true })).toHaveText(itemName);
    await closeMenuWithEscape();
  };

  const expectCurrentSectionIndicator = async (section: SectionValue): Promise<void> => {
    const link = navigation.getByRole('link', { exact: true, name: getSectionTitle(section) });

    await expect(link).toHaveAttribute('aria-current', 'page');

    const indicatorColor = await readTokenColor('--color-indicator');

    await expect(link).toHaveCSS('background-color', indicatorColor, { pseudo: 'after' });
    await expect(link).toHaveCSS('height', '3px', { pseudo: 'after' });
  };

  return {
    async blurActiveElement(): Promise<void> {
      await page.evaluate(BLUR_ACTIVE_ELEMENT);
      await expect.poll(() => page.evaluate<boolean>(READ_IS_FOCUS_ON_BODY)).toBe(true);
    },
    async cancelResetConfirm(): Promise<void> {
      await cancelResetButton.click();
    },
    closeMenuWithEscape,
    async closeResetConfirmWithEscape(): Promise<void> {
      await page.keyboard.press('Escape');
    },
    async closeSearchWithEscape(): Promise<void> {
      await page.keyboard.press('Escape');
    },
    async expectBannerShown(): Promise<void> {
      await expect(banner).toBeVisible();
    },
    async expectBrand(organizationName: string): Promise<void> {
      await expect(banner.getByText(organizationName, { exact: true })).toBeVisible();
    },
    async expectCurrentSection(section: SectionValue): Promise<void> {
      if (isPhone) {
        await expectMenuRadioChecked(getText('app.nav.label'), getSectionTitle(section));

        return;
      }

      await expectCurrentSectionIndicator(section);
    },
    async expectDocumentTheme(theme: 'dark' | 'light'): Promise<void> {
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    },
    async expectFocusNotOnBody(): Promise<void> {
      await expect.poll(() => page.evaluate<boolean>(READ_IS_FOCUS_ON_BODY)).toBe(false);
    },
    async expectFocusOnKnownElement(section: SectionValue): Promise<void> {
      await expect(getKnownElement(section)).toBeFocused();
    },
    async expectFocusOnMenuButton(): Promise<void> {
      await expect(menuButton).toBeFocused();
    },
    async expectFocusOnResetOpener(): Promise<void> {
      await expect(resetOpener).toBeFocused();
    },
    async expectFocusOnSearchField(): Promise<void> {
      await expect(searchField).toBeFocused();
    },
    async expectFocusOnSearchToggle(): Promise<void> {
      await expect(searchToggle).toBeFocused();
    },
    async expectMenuChunkRequestCount(count: number): Promise<void> {
      await expect.poll(() => menuChunkRequests.length).toBe(count);
    },
    expectMenuClosed,
    expectMenuOpen,
    async expectNoHorizontalScroll(): Promise<void> {
      await expect.poll(() => page.evaluate<number>(READ_HORIZONTAL_OVERFLOW)).toBeLessThanOrEqual(0);
    },
    async expectPanelBackgroundFromTheme(): Promise<string> {
      const panelColor = await readTokenColor('--color-panel');

      await expect(banner).toHaveCSS('background-color', panelColor);

      return panelColor;
    },
    async expectPersonaSwitcher(currentPersona: PersonaValue): Promise<void> {
      if (isDesktop) {
        await expect(barPersonaTrigger).toBeVisible();
        await expect(barPersonaTrigger).toHaveAccessibleName(
          getText('persona.trigger.label').replace('{persona}', getPersonaLabel(currentPersona)),
        );

        return;
      }

      await expect(barPersonaTrigger).toBeHidden();
      await openMenu();
      await expect(getMenuGroup(getText('persona.menu.label')).getByRole('menuitemradio')).toHaveCount(PERSONA_COUNT);
      await closeMenuWithEscape();
      await expectMenuRadioChecked(getText('persona.menu.label'), getPersonaLabel(currentPersona));
    },
    async expectResetAnnounced(): Promise<void> {
      await expect(resetAnnouncement).toHaveCount(1);
    },
    async expectResetButtonExpanded(isExpanded: boolean): Promise<void> {
      await expect(resetButton).toHaveAttribute('aria-expanded', String(isExpanded));
    },
    async expectResetConfirmClosed(): Promise<void> {
      await expect(resetConfirm).toHaveCount(0);
    },
    async expectResetConfirmFocusedOnCancel(): Promise<void> {
      await expect(cancelResetButton).toBeFocused();
    },
    async expectResetConfirmOpen(): Promise<void> {
      await expect(resetConfirm).toBeVisible();
      await expect(resetConfirm.getByText(getText('demo.reset.confirm.hint'))).toBeVisible();
    },
    async expectResetNotAnnounced(): Promise<void> {
      await expect(resetAnnouncement).toHaveCount(0);
    },
    async expectSearchAvailable(): Promise<void> {
      if (isPhone) {
        await expect(searchField).toBeHidden();
        await expect(searchToggle).toBeVisible();
        await expect(searchToggle).toHaveAttribute('aria-expanded', 'false');
        await searchToggle.click();
        await expect(searchToggle).toHaveAttribute('aria-expanded', 'true');
        await expect(searchField).toBeFocused();

        return;
      }

      await expect(searchToggle).toBeHidden();
      await expect(searchField).toBeVisible();
    },
    async expectSearchEmpty(): Promise<void> {
      await expect(searchField).toHaveValue('');
    },
    async expectSearchFolded(): Promise<void> {
      await expect(searchField).toBeHidden();
      await expect(foldedSearchField).toHaveValue('');
      await expect(searchToggle).toHaveAttribute('aria-expanded', 'false');
    },
    async expectSearchNoteHidden(): Promise<void> {
      await expect(searchNote).toHaveCount(0);
    },
    async expectSearchUnavailableNote(): Promise<void> {
      await expect(searchNote).toBeVisible();
    },
    async expectSearchValue(value: string): Promise<void> {
      await expect(searchField).toHaveValue(value);
    },
    async expectSections(sections: readonly SectionValue[]): Promise<void> {
      if (isPhone) {
        await expect(navigation).toBeHidden();
        await openMenu();
        await expect(getMenuGroup(getText('app.nav.label')).getByRole('menuitemradio')).toHaveText(sections.map(getSectionTitle));
        await closeMenuWithEscape();

        return;
      }

      await expect(navigation).toBeVisible();
      await expect(navigation.getByRole('link')).toHaveText(sections.map(getSectionTitle));
    },
    async expectThemeChecked(theme: ThemePreferenceValue): Promise<void> {
      if (isDesktop) {
        await expect(getBarThemeRadio(theme)).toBeChecked();

        return;
      }

      await expectMenuRadioChecked(getText('theme.label'), getThemeLabel(theme));
    },
    async expectThemeControl(): Promise<void> {
      if (isDesktop) {
        await expect(barThemeGroup).toBeVisible();
        await expect(barThemeGroup.getByRole('radio')).toHaveCount(3);
        await expect(getBarThemeLabel('light')).toBeVisible();
        await expect(getBarThemeLabel('dark')).toBeVisible();
        await expect(getBarThemeLabel('system')).toBeVisible();

        return;
      }

      await expect(barThemeGroup).toBeHidden();
      await openMenu();
      await expect(getMenuGroup(getText('theme.label')).getByRole('menuitemradio')).toHaveText([
        getThemeLabel('light'),
        getThemeLabel('dark'),
        getThemeLabel('system'),
      ]);
      await closeMenuWithEscape();
    },
    async focusKnownElement(section: SectionValue): Promise<void> {
      const knownElement = getKnownElement(section);

      await expect(knownElement).toBeVisible();
      await knownElement.focus();
      await expect(knownElement).toBeFocused();
    },
    async focusThemeOption(theme: ThemePreferenceValue): Promise<void> {
      await getBarThemeRadio(theme).focus();
      await expect(getBarThemeRadio(theme)).toBeFocused();
    },
    openMenu,
    async openSearchWithToggle(): Promise<void> {
      await expect(searchToggle).toBeVisible();
      await searchToggle.click();
      await expect(searchToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(searchField).toBeFocused();
    },
    async pressArrowOnTheme(key: 'ArrowLeft' | 'ArrowRight'): Promise<void> {
      await page.keyboard.press(key);
    },
    async pressEnterInSearch(): Promise<void> {
      await searchField.press('Enter');
    },
    async pressSlash(): Promise<void> {
      await page.keyboard.press('/');
    },
    async pressSlashOfRussianLayout(): Promise<void> {
      await page.evaluate(DISPATCH_RUSSIAN_LAYOUT_SLASH);
    },
    async requestReset(): Promise<void> {
      if (isDesktop) {
        await resetButton.click();

        return;
      }

      await chooseInMenu('menuitem', getText('menu.resetDemo'));
    },
    async resetFromConfirm(): Promise<void> {
      await acceptResetButton.click();
    },
    async selectMenuPersona(persona: PersonaValue): Promise<void> {
      await chooseInMenu('menuitemradio', getPersonaLabel(persona));
    },
    async selectMenuSection(section: SectionValue): Promise<void> {
      await chooseInMenu('menuitemradio', getSectionTitle(section));
    },
    async selectTheme(theme: ThemePreferenceValue): Promise<void> {
      if (isDesktop) {
        await getBarThemeLabel(theme).click();
        await expect(getBarThemeRadio(theme)).toBeChecked();

        return;
      }

      await chooseInMenu('menuitemradio', getThemeLabel(theme));
    },
    async typeInSearch(text: string): Promise<void> {
      await searchField.pressSequentially(text);
    },
  };
};
