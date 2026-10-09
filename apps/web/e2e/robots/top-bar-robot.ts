import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type { PersonaValue } from '../fixtures/demoData.ts';
import type { SectionValue } from '../fixtures/routes.ts';
import type { TopBarLayoutValue } from '../fixtures/viewports.ts';
import type { ThemePreferenceValue } from './profile-menu-locators.ts';

import {
  PERSONA_COUNT,
  PERSONA_GROUPS,
  PERSONAS_PER_GROUP,
} from '../fixtures/demoData.ts';
import { getText } from '../fixtures/messages.ts';
import {
  BLUR_ACTIVE_ELEMENT,
  createReadTokenColorScript,
  DISPATCH_RUSSIAN_LAYOUT_SLASH,
  READ_HORIZONTAL_OVERFLOW,
  READ_IS_FOCUS_ON_BODY,
  READ_LANDMARKS_HIDDEN_FROM_READERS,
  SETTLE_FINITE_ANIMATIONS,
} from '../fixtures/pageScripts.ts';
import {
  getPersonaLabel,
  getPersonaSecondLine,
  getProfileButtonLabel,
  getSideLabel,
} from '../fixtures/personaLabels.ts';
import { getSectionTitle } from '../fixtures/routes.ts';
import {
  createProfileMenuLocators,
  getThemeLabel,
} from './profile-menu-locators.ts';

export type { ThemePreferenceValue } from './profile-menu-locators.ts';

const PROFILE_MENU_CHUNK_PATTERN = /\/ProfileMenu-[^/]+\.js$/;

const MIN_TOUCH_TARGET_PX = 44;

const THEMES: readonly ThemePreferenceValue[] = ['light', 'dark', 'system'];

const SAME_POSITION_TOLERANCE_PX = 1;

export interface PanelGeometryValue {
  mainTop: number;
  panelHeight: number;
  panelWidth: number;
}

export interface TopBarRobotValue {
  blurActiveElement: () => Promise<void>;
  cancelResetConfirm: () => Promise<void>;
  clickOutsideMenu: () => Promise<void>;
  clickSearchWhileMenuOpen: () => Promise<void>;
  clickSectionLinkWhileMenuOpen: (section: SectionValue) => Promise<void>;
  closeMenuWithEscape: () => Promise<void>;
  closeResetConfirmWithEscape: () => Promise<void>;
  closeSearchWithButton: () => Promise<void>;
  closeSearchWithEscape: () => Promise<void>;
  expectBannerAndMainExposed: () => Promise<void>;
  expectBannerShown: () => Promise<void>;
  expectButtonBusy: (isBusy: boolean) => Promise<void>;
  expectButtonTouchTarget: () => Promise<void>;
  expectCurrentSection: (section: SectionValue) => Promise<void>;
  expectCurrentSectionMarkedWithoutCheckmark: (section: SectionValue) => Promise<void>;
  expectDocumentTheme: (theme: 'dark' | 'light') => Promise<void>;
  expectFocusNotOnBody: () => Promise<void>;
  expectFocusNotOnProfileButton: () => Promise<void>;
  expectFocusOnKnownElement: (section: SectionValue) => Promise<void>;
  expectFocusOnProfileButton: () => Promise<void>;
  expectFocusOnSearchField: () => Promise<void>;
  expectFocusOnSearchToggle: () => Promise<void>;
  expectMenuChunkRequestCount: (count: number) => Promise<void>;
  expectMenuClosed: () => Promise<void>;
  expectMenuContent: (persona: PersonaValue) => Promise<void>;
  expectMenuItemsTouchTargets: () => Promise<void>;
  expectMenuOpen: () => Promise<void>;
  expectNoHorizontalScroll: () => Promise<void>;
  expectNoSectionsInMenu: () => Promise<void>;
  expectNoSignInLabel: () => Promise<void>;
  expectPanelBackgroundFromTheme: () => Promise<string>;
  expectPanelGeometryKept: (before: PanelGeometryValue) => Promise<void>;
  expectPersonaPicker: (currentPersona: PersonaValue) => Promise<void>;
  expectPhoneSearchClosed: () => Promise<void>;
  expectPhoneSearchOpen: () => Promise<void>;
  expectProductMark: () => Promise<void>;
  expectProfileButton: (persona: PersonaValue) => Promise<void>;
  expectProfileButtonLast: () => Promise<void>;
  expectResetAnnounced: () => Promise<void>;
  expectResetConfirmClosed: () => Promise<void>;
  expectResetConfirmFocusedOnCancel: () => Promise<void>;
  expectResetConfirmOpen: () => Promise<void>;
  expectResetItemReachableWithKeyboard: () => Promise<void>;
  expectResetNotAnnounced: () => Promise<void>;
  expectSearchAvailable: () => Promise<void>;
  expectSearchEmpty: () => Promise<void>;
  expectSearchFolded: () => Promise<void>;
  expectSearchNoteHidden: () => Promise<void>;
  expectSearchRowInsidePanel: () => Promise<void>;
  expectSearchUnavailableNote: () => Promise<void>;
  expectSearchValue: (value: string) => Promise<void>;
  expectSections: (sections: readonly SectionValue[]) => Promise<void>;
  expectThemeChecked: (theme: ThemePreferenceValue) => Promise<void>;
  expectThemeFocusMovesWithoutChange: (theme: ThemePreferenceValue) => Promise<void>;
  expectThemeItemsNamedByVisibleText: () => Promise<void>;
  expectThemeRow: () => Promise<void>;
  focusKnownElement: (section: SectionValue) => Promise<void>;
  focusProfileButton: () => Promise<void>;
  hoverProfileButton: () => Promise<void>;
  openMenu: () => Promise<void>;
  openSearchWithToggle: () => Promise<void>;
  pressEnterInSearch: () => Promise<void>;
  pressProfileButton: () => Promise<void>;
  pressProfileButtonWithEnter: () => Promise<void>;
  pressShiftTabInMenu: () => Promise<void>;
  pressSlash: () => Promise<void>;
  pressSlashOfRussianLayout: () => Promise<void>;
  pressTab: () => Promise<void>;
  pressTabInMenu: () => Promise<void>;
  readPanelGeometry: () => Promise<PanelGeometryValue>;
  requestReset: () => Promise<void>;
  resetFromConfirm: () => Promise<void>;
  selectMenuSection: (section: SectionValue) => Promise<void>;
  selectTheme: (theme: ThemePreferenceValue) => Promise<void>;
  typeInSearch: (text: string) => Promise<void>;
}

export const createTopBarRobot = (page: Page, layout: TopBarLayoutValue): TopBarRobotValue => {
  const isPhone = layout === 'phone';
  const menuChunkRequests: string[] = [];

  page.on('request', (request) => {
    if (PROFILE_MENU_CHUNK_PATTERN.test(new URL(request.url()).pathname)) {
      menuChunkRequests.push(request.url());
    }
  });

  const {
    allItems,
    banner,
    button: profileButton,
    buttonIncludingHidden: profileButtonIncludingHidden,
    getPersonaGroup,
    getThemeItem,
    menu,
    personaItems,
    resetItem,
    sectionsGroup,
    themeGroup,
  } = createProfileMenuLocators(page);
  const main = page.getByRole('main');
  const productMark = banner.getByText(getText('app.productName'), { exact: true });
  const navigation = banner.getByRole('navigation', { name: getText('app.nav.label') });
  const searchField = banner.getByRole('searchbox', { name: getText('search.label') });
  const foldedSearchField = banner.getByRole('searchbox', { includeHidden: true, name: getText('search.label') });
  const searchToggle = banner.getByRole('button', { name: getText('search.open') });
  const searchToggleIncludingHidden = banner.getByRole('button', { includeHidden: true, name: getText('search.open') });
  const searchClose = banner.getByRole('button', { name: getText('search.close') });
  const productMarkIcon = page.getByTestId('product-mark');
  const clockSlot = page.getByTestId('top-bar-clock-slot');
  const searchNote = banner.getByRole('status').filter({ hasText: getText('search.unavailable') });
  const resetConfirm = page.getByRole('group', { name: getText('demo.reset.confirm.prompt') });
  const cancelResetButton = resetConfirm.getByRole('button', { exact: true, name: getText('demo.reset.confirm.cancel') });
  const acceptResetButton = resetConfirm.getByRole('button', { exact: true, name: getText('demo.reset.confirm.accept') });
  const resetAnnouncement = page.getByRole('status').filter({ hasText: getText('demo.reset.done') });

  const getKnownElement = (section: SectionValue): Locator => {
    if (isPhone) {
      return profileButton;
    }

    return navigation.getByRole('link', { exact: true, name: getSectionTitle(section) });
  };

  const readTokenColor = (tokenName: string): Promise<string> => page.evaluate<string>(createReadTokenColorScript(tokenName));

  const expectMenuOpen = async (): Promise<void> => {
    await expect(menu).toBeVisible();
    await expect(profileButton).toHaveAttribute('aria-expanded', 'true');
  };

  const expectMenuClosed = async (): Promise<void> => {
    await expect(menu).toHaveCount(0);
    await expect(profileButtonIncludingHidden).toHaveAttribute('aria-expanded', 'false');
  };

  const settleAnimations = async (): Promise<void> => {
    await page.evaluate<number>(SETTLE_FINITE_ANIMATIONS);
  };

  const openMenu = async (): Promise<void> => {
    await expect(profileButton).toBeVisible();
    await profileButton.click();
    await expectMenuOpen();
    await settleAnimations();
  };

  const closeMenuWithEscape = async (): Promise<void> => {
    await page.keyboard.press('Escape');
    await expectMenuClosed();
    await expect(profileButton).toBeFocused();
  };

  const chooseInMenu = async (item: Locator): Promise<void> => {
    await openMenu();
    await item.click();
    await expect(menu).toHaveCount(0);
  };

  const expectBoxAtLeastTouchTarget = async (target: Locator, description: string): Promise<void> => {
    const box = await target.boundingBox();

    expect(box, description).not.toBeNull();
    expect(box?.width ?? 0, `${description} width`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(box?.height ?? 0, `${description} height`).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
  };

  const readBox = async (target: Locator, description: string): Promise<{ height: number; width: number; x: number; y: number }> => {
    const box = await target.boundingBox();

    if (box === null) {
      throw new Error(`The box of ${description} is not available`);
    }

    return box;
  };

  const readPanelGeometry = async (): Promise<PanelGeometryValue> => {
    const bannerBox = await readBox(banner, 'the banner');
    const mainBox = await readBox(main, 'the main area');

    return { mainTop: mainBox.y, panelHeight: bannerBox.height, panelWidth: bannerBox.width };
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
    async clickOutsideMenu(): Promise<void> {
      await expectMenuOpen();
      await productMark.click();
    },
    async clickSearchWhileMenuOpen(): Promise<void> {
      await expectMenuOpen();

      if (isPhone) {
        await searchToggle.click();

        return;
      }

      await searchField.click();
    },
    async clickSectionLinkWhileMenuOpen(section: SectionValue): Promise<void> {
      await expectMenuOpen();
      await navigation.getByRole('link', { exact: true, name: getSectionTitle(section) }).click();
    },
    closeMenuWithEscape,
    async closeResetConfirmWithEscape(): Promise<void> {
      await page.keyboard.press('Escape');
    },
    async closeSearchWithButton(): Promise<void> {
      await searchClose.click();
    },
    async closeSearchWithEscape(): Promise<void> {
      await page.keyboard.press('Escape');
    },
    async expectBannerAndMainExposed(): Promise<void> {
      await expectMenuOpen();
      await expect(banner).toBeVisible();
      await expect(main).toBeVisible();
      await expect.poll(() => page.evaluate<number>(READ_LANDMARKS_HIDDEN_FROM_READERS)).toBe(0);
    },
    async expectBannerShown(): Promise<void> {
      await expect(banner).toBeVisible();
    },
    async expectButtonBusy(isBusy: boolean): Promise<void> {
      if (isBusy) {
        await expect(profileButton).toHaveAttribute('aria-busy', 'true');

        return;
      }

      await expect(profileButton).not.toHaveAttribute('aria-busy', 'true');
    },
    async expectButtonTouchTarget(): Promise<void> {
      await expectBoxAtLeastTouchTarget(profileButton, 'profile button');
    },
    async expectCurrentSection(section: SectionValue): Promise<void> {
      if (isPhone) {
        await openMenu();
        await expect(sectionsGroup.getByRole('menuitemradio', { checked: true })).toHaveText(getSectionTitle(section));
        await closeMenuWithEscape();

        return;
      }

      await expectCurrentSectionIndicator(section);
    },
    async expectCurrentSectionMarkedWithoutCheckmark(section: SectionValue): Promise<void> {
      await openMenu();

      const currentItem = sectionsGroup.getByRole('menuitemradio', { checked: true });

      await expect(currentItem).toHaveCount(1);
      await expect(currentItem).toHaveAttribute('aria-checked', 'true');
      await expect(currentItem).toHaveText(getSectionTitle(section));
      await expect(sectionsGroup.locator('svg')).toHaveCount(0);

      const indicatorColor = await readTokenColor('--color-indicator');
      const label = currentItem.locator('span');

      await expect(label).toHaveCSS('background-color', indicatorColor, { pseudo: 'after' });
      await expect(label).toHaveCSS('height', '3px', { pseudo: 'after' });

      const otherItems = sectionsGroup.getByRole('menuitemradio', { checked: false });

      await expect(otherItems.locator('span').first()).not.toHaveCSS('height', '3px', { pseudo: 'after' });
      await closeMenuWithEscape();
    },
    async expectDocumentTheme(theme: 'dark' | 'light'): Promise<void> {
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    },
    async expectFocusNotOnBody(): Promise<void> {
      await expect.poll(() => page.evaluate<boolean>(READ_IS_FOCUS_ON_BODY)).toBe(false);
    },
    async expectFocusNotOnProfileButton(): Promise<void> {
      await expect(profileButton).not.toBeFocused();
    },
    async expectFocusOnKnownElement(section: SectionValue): Promise<void> {
      await expect(getKnownElement(section)).toBeFocused();
    },
    async expectFocusOnProfileButton(): Promise<void> {
      await expect(profileButton).toBeFocused();
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
    async expectMenuContent(persona: PersonaValue): Promise<void> {
      await expectMenuOpen();
      await expect(page.getByTestId('profile-menu-name')).toHaveText(persona.userDisplayName);
      await expect(page.getByTestId('profile-menu-role')).toHaveText(getPersonaSecondLine(persona));
      await expect(page.getByTestId('profile-menu-sides')).toContainText(getSideLabel(persona));
      await expect(personaItems).toHaveCount(PERSONA_COUNT);

      for (const { group } of PERSONA_GROUPS) {
        await expect(getPersonaGroup(group).getByRole('menuitemradio')).toHaveCount(PERSONAS_PER_GROUP);
      }

      await expect(personaItems.and(page.locator('[aria-checked="true"]'))).toHaveCount(1);
      await expect(menu.getByRole('menuitemradio', { checked: true, name: getPersonaLabel(persona) })).toHaveCount(1);
      await expect(themeGroup.getByRole('menuitemradio')).toHaveCount(THEMES.length);
      await expect(resetItem).toBeVisible();
    },
    async expectMenuItemsTouchTargets(): Promise<void> {
      await expectMenuOpen();
      await settleAnimations();
      await expect(personaItems).toHaveCount(PERSONA_COUNT);

      const itemCount = await allItems.count();

      expect(itemCount).toBeGreaterThan(0);

      for (let index = 0; index < itemCount; index += 1) {
        const item = allItems.nth(index);
        const name = await item.getAttribute('aria-label') ?? await item.innerText();

        await expectBoxAtLeastTouchTarget(item, `menu item ${name.trim()}`);
      }
    },
    expectMenuOpen,
    async expectNoHorizontalScroll(): Promise<void> {
      await expect.poll(() => page.evaluate<number>(READ_HORIZONTAL_OVERFLOW)).toBeLessThanOrEqual(0);
    },
    async expectNoSectionsInMenu(): Promise<void> {
      await expectMenuOpen();
      await expect(sectionsGroup).toHaveCount(0);
    },
    async expectNoSignInLabel(): Promise<void> {
      await expect(page.getByText(/Войти как/)).toHaveCount(0);
      await expect(page.getByRole('button', { includeHidden: true, name: /Войти как/ })).toHaveCount(0);
    },
    async expectPanelBackgroundFromTheme(): Promise<string> {
      const panelColor = await readTokenColor('--color-panel');

      await expect(banner).toHaveCSS('background-color', panelColor);

      return panelColor;
    },
    async expectPanelGeometryKept(before: PanelGeometryValue): Promise<void> {
      await expect.poll(async () => {
        const current = await readPanelGeometry();

        return {
          mainTop: Math.abs(current.mainTop - before.mainTop) <= SAME_POSITION_TOLERANCE_PX,
          panelHeight: Math.abs(current.panelHeight - before.panelHeight) <= SAME_POSITION_TOLERANCE_PX,
          panelWidth: Math.abs(current.panelWidth - before.panelWidth) <= SAME_POSITION_TOLERANCE_PX,
        };
      }).toEqual({ mainTop: true, panelHeight: true, panelWidth: true });
    },
    async expectPersonaPicker(currentPersona: PersonaValue): Promise<void> {
      await openMenu();
      await expect(personaItems).toHaveCount(PERSONA_COUNT);
      await expect(menu.getByRole('menuitemradio', { checked: true, name: getPersonaLabel(currentPersona) })).toHaveCount(1);
      await closeMenuWithEscape();
    },
    async expectPhoneSearchClosed(): Promise<void> {
      await expect(searchField).toBeHidden();
      await expect(searchClose).toBeHidden();
      await expect(searchToggle).toBeVisible();
      await expect(searchToggle).toHaveAttribute('aria-expanded', 'false');
      await expect(productMarkIcon).toBeVisible();
      await expect(clockSlot).toBeVisible();
      await expect(profileButton).toBeVisible();
    },
    async expectPhoneSearchOpen(): Promise<void> {
      await expect(searchField).toBeVisible();
      await expect(searchField).toBeFocused();
      await expect(searchClose).toBeVisible();
      await expect(searchToggle).toBeHidden();
      await expect(searchToggleIncludingHidden).toHaveAttribute('aria-expanded', 'true');
      await expect(productMarkIcon).toBeHidden();
      await expect(clockSlot).toBeHidden();
      await expect(profileButton).toBeHidden();
    },
    async expectProductMark(): Promise<void> {
      await expect(productMark).toBeVisible();
    },
    async expectProfileButton(persona: PersonaValue): Promise<void> {
      await expect(profileButton).toBeVisible();
      await expect(profileButton).toHaveAccessibleName(getProfileButtonLabel(persona));
      await expect(profileButton).toHaveAttribute('aria-haspopup', 'menu');
      await expect(profileButton.getByText(persona.initials, { exact: true })).toBeVisible();
    },
    async expectProfileButtonLast(): Promise<void> {
      const buttonBox = await profileButton.boundingBox();
      const bannerBox = await banner.boundingBox();

      expect(buttonBox).not.toBeNull();
      expect(bannerBox).not.toBeNull();

      const buttonRight = (buttonBox?.x ?? 0) + (buttonBox?.width ?? 0);
      const bannerRight = (bannerBox?.x ?? 0) + (bannerBox?.width ?? 0);

      expect(buttonRight).toBeLessThanOrEqual(bannerRight);
      expect(bannerRight - buttonRight).toBeLessThan(40);

      await expect(banner.getByRole('button')).toHaveCount(layout === 'phone' ? 2 : 1);
    },
    async expectResetAnnounced(): Promise<void> {
      await expect(resetAnnouncement).toHaveCount(1);
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
    async expectResetItemReachableWithKeyboard(): Promise<void> {
      const itemCount = await allItems.count();

      for (let press = 0; press < itemCount; press += 1) {
        const focusedCount = await resetItem.and(page.locator(':focus')).count();

        if (focusedCount > 0) {
          break;
        }

        await page.keyboard.press('ArrowDown');
      }

      await expect(resetItem).toBeFocused();
      await expect(resetItem).toBeInViewport();
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
        await expect(searchToggleIncludingHidden).toHaveAttribute('aria-expanded', 'true');
        await expect(searchField).toBeFocused();
        await expect(searchClose).toBeVisible();
        await searchClose.click();
        await expect(searchToggle).toBeFocused();
        await expect(searchToggle).toHaveAttribute('aria-expanded', 'false');
        await expect(searchField).toBeHidden();

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
    async expectSearchRowInsidePanel(): Promise<void> {
      const bannerBox = await readBox(banner, 'the banner');
      const visibleControls = isPhone && (await searchClose.isVisible())
        ? [searchField, searchClose]
        : [productMarkIcon, searchToggle, clockSlot, profileButton];

      for (const control of visibleControls) {
        const box = await readBox(control, 'a control of the panel row');

        expect(box.x).toBeGreaterThanOrEqual(bannerBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(bannerBox.x + bannerBox.width);
        expect(box.y).toBeGreaterThanOrEqual(bannerBox.y);
        expect(box.y + box.height).toBeLessThanOrEqual(bannerBox.y + bannerBox.height);
      }
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
        await expect(sectionsGroup.getByRole('menuitemradio')).toHaveText(sections.map(getSectionTitle));
        await closeMenuWithEscape();

        return;
      }

      await expect(navigation).toBeVisible();
      await expect(navigation.getByRole('link')).toHaveText(sections.map(getSectionTitle));
    },
    async expectThemeChecked(theme: ThemePreferenceValue): Promise<void> {
      await openMenu();
      await expect(themeGroup.getByRole('menuitemradio', { checked: true })).toHaveCount(1);
      await expect(getThemeItem(theme)).toHaveAttribute('aria-checked', 'true');
      await closeMenuWithEscape();
    },
    async expectThemeFocusMovesWithoutChange(theme: ThemePreferenceValue): Promise<void> {
      const documentTheme = await page.locator('html').getAttribute('data-theme');

      await openMenu();
      await getThemeItem(theme).focus();
      await expect(getThemeItem(theme)).toBeFocused();

      const startIndex = THEMES.indexOf(theme);
      const nextTheme = THEMES[startIndex + 1];

      expect(nextTheme).toBeDefined();

      if (nextTheme !== undefined) {
        await page.keyboard.press('ArrowDown');
        await expect(getThemeItem(nextTheme)).toBeFocused();
      }

      await expect(getThemeItem(theme)).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('html')).toHaveAttribute('data-theme', documentTheme ?? '');
      await closeMenuWithEscape();
    },
    async expectThemeItemsNamedByVisibleText(): Promise<void> {
      await openMenu();

      for (const theme of THEMES) {
        const item = getThemeItem(theme);
        const label = getThemeLabel(theme);

        await expect(item).toHaveText(label);
        await expect(item).toHaveAccessibleName(label);
        await expect(item).not.toHaveAttribute('aria-label', /.*/);
      }

      await closeMenuWithEscape();
    },
    async expectThemeRow(): Promise<void> {
      await openMenu();
      await expect(themeGroup.getByRole('menuitemradio')).toHaveCount(THEMES.length);

      for (const theme of THEMES) {
        await expect(getThemeItem(theme)).toBeVisible();
      }

      const boxes = await Promise.all(THEMES.map(theme => getThemeItem(theme).boundingBox()));
      const tops = boxes.map(box => Math.round(box?.y ?? -1));

      expect(new Set(tops).size).toBe(1);
      expect(tops[0]).toBeGreaterThanOrEqual(0);

      await closeMenuWithEscape();
    },
    async focusKnownElement(section: SectionValue): Promise<void> {
      const knownElement = getKnownElement(section);

      await expect(knownElement).toBeVisible();
      await knownElement.focus();
      await expect(knownElement).toBeFocused();
    },
    async focusProfileButton(): Promise<void> {
      await expect(profileButton).toBeVisible();
      await profileButton.focus();
      await expect(profileButton).toBeFocused();
    },
    async hoverProfileButton(): Promise<void> {
      await profileButton.hover();
    },
    openMenu,
    async openSearchWithToggle(): Promise<void> {
      await expect(searchToggle).toBeVisible();
      await searchToggle.click();
      await expect(searchToggleIncludingHidden).toHaveAttribute('aria-expanded', 'true');
      await expect(searchField).toBeFocused();
    },
    async pressEnterInSearch(): Promise<void> {
      await searchField.press('Enter');
    },
    async pressProfileButton(): Promise<void> {
      await profileButton.click();
    },
    async pressProfileButtonWithEnter(): Promise<void> {
      await profileButton.focus();
      await expect(profileButton).toBeFocused();
      await page.keyboard.press('Enter');
    },
    async pressShiftTabInMenu(): Promise<void> {
      await expectMenuOpen();
      await page.keyboard.press('Shift+Tab');
    },
    async pressSlash(): Promise<void> {
      await page.keyboard.press('/');
    },
    async pressSlashOfRussianLayout(): Promise<void> {
      await page.evaluate(DISPATCH_RUSSIAN_LAYOUT_SLASH);
    },
    async pressTab(): Promise<void> {
      await page.keyboard.press('Tab');
    },
    async pressTabInMenu(): Promise<void> {
      await expectMenuOpen();
      await page.keyboard.press('Tab');
    },
    readPanelGeometry,
    async requestReset(): Promise<void> {
      await chooseInMenu(resetItem);
    },
    async resetFromConfirm(): Promise<void> {
      await acceptResetButton.click();
    },
    async selectMenuSection(section: SectionValue): Promise<void> {
      await chooseInMenu(sectionsGroup.getByRole('menuitemradio', { exact: true, name: getSectionTitle(section) }));
    },
    async selectTheme(theme: ThemePreferenceValue): Promise<void> {
      await chooseInMenu(getThemeItem(theme));
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'system' ? /^(dark|light)$/ : theme);
    },
    async typeInSearch(text: string): Promise<void> {
      await searchField.pressSequentially(text);
    },
  };
};
