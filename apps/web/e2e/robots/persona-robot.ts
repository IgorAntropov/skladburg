import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import type { PersonaValue } from '../fixtures/demoData.ts';
import type { SectionValue } from '../fixtures/routes.ts';

import {
  PERSONA_COUNT,
  PERSONA_GROUPS,
  PERSONAS_PER_GROUP,
} from '../fixtures/demoData.ts';
import { getText } from '../fixtures/messages.ts';
import {
  getGroupTitle,
  getPersonaLabel,
  getProfileButtonLabel,
} from '../fixtures/personaLabels.ts';
import { getSectionTitle } from '../fixtures/routes.ts';
import { createProfileMenuLocators } from './profile-menu-locators.ts';

const MAX_TAB_PRESSES = 20;

const TAB_KEYS = ['Tab', 'Alt+Tab'] as const;

const getSwitchedAnnouncement = (persona: PersonaValue): string => getText('persona.switched')
  .replace('{persona}', getPersonaLabel(persona));

export interface PersonaRobotValue {
  closeMenuWithEscape: () => Promise<void>;
  expectAllPersonasListed: () => Promise<void>;
  expectCheckedPersona: (persona: PersonaValue) => Promise<void>;
  expectCurrentPersona: (persona: PersonaValue) => Promise<void>;
  expectMenuClosed: () => Promise<void>;
  expectMenuOpen: () => Promise<void>;
  expectMenuOpenedWithFocusInside: () => Promise<void>;
  expectPersonasLoaded: () => Promise<void>;
  expectSectionHeading: (section: SectionValue) => Promise<void>;
  expectSections: (sections: readonly SectionValue[]) => Promise<void>;
  expectSwitchAnnounced: (persona: PersonaValue) => Promise<void>;
  expectSwitcherReady: () => Promise<void>;
  expectTriggerFocused: () => Promise<void>;
  focusTrigger: () => Promise<void>;
  focusTriggerWithTab: () => Promise<void>;
  highlightPersonaWithArrows: (persona: PersonaValue) => Promise<void>;
  openAsPersona: (hash: string, personaId: string) => Promise<void>;
  openMenuWithArrowDown: () => Promise<void>;
  openMenuWithClick: () => Promise<void>;
  openMenuWithEnter: () => Promise<void>;
  pressArrowDownInMenu: (times: number) => Promise<void>;
  pressArrowUpInMenu: (times: number) => Promise<void>;
  pressEnterOnHighlightedPersona: () => Promise<void>;
  selectPersona: (persona: PersonaValue) => Promise<void>;
}

export const createPersonaRobot = (page: Page): PersonaRobotValue => {
  const {
    allItems,
    banner,
    button: trigger,
    getPersonaGroup,
    getPersonaItem,
    menu,
    personaItems,
  } = createProfileMenuLocators(page);
  const main = page.getByRole('main');
  const navigation = page.getByRole('navigation', { name: getText('app.nav.label') });

  const expectSwitcherReady = async (): Promise<void> => {
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeEnabled();
    await expect(trigger).not.toHaveAttribute('aria-busy', 'true');
  };

  const expectMenuOpen = async (): Promise<void> => {
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  };

  const expectMenuClosed = async (): Promise<void> => {
    await expect(menu).toHaveCount(0);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  };

  const expectTriggerFocused = async (): Promise<void> => {
    await expect(trigger).toBeFocused();
  };

  const expectPersonasLoaded = async (): Promise<void> => {
    await expect(personaItems).toHaveCount(PERSONA_COUNT);
  };

  const closeMenuWithEscape = async (): Promise<void> => {
    await page.keyboard.press('Escape');
    await expectMenuClosed();
  };

  const openMenuWithClick = async (): Promise<void> => {
    await expectSwitcherReady();
    await trigger.click();
    await expectMenuOpen();
    await expectPersonasLoaded();
  };

  const focusTrigger = async (): Promise<void> => {
    await expectSwitcherReady();
    await trigger.focus();
    await expectTriggerFocused();
  };

  const getFocusedItemIndex = async (): Promise<number> => {
    const itemCount = await allItems.count();

    for (let index = 0; index < itemCount; index += 1) {
      const focusedCount = await allItems.nth(index).and(page.locator(':focus')).count();

      if (focusedCount > 0) {
        return index;
      }
    }

    return -1;
  };

  const pressArrowInMenu = async (key: 'ArrowDown' | 'ArrowUp', times: number): Promise<void> => {
    for (let press = 0; press < times; press += 1) {
      const previousIndex = await getFocusedItemIndex();

      await page.keyboard.press(key);
      await expect.poll(getFocusedItemIndex).not.toBe(previousIndex);
    }
  };

  const getItemIndex = async (persona: PersonaValue): Promise<number> => {
    const itemCount = await allItems.count();
    const label = getPersonaLabel(persona);

    for (let index = 0; index < itemCount; index += 1) {
      const itemLabel = await allItems.nth(index).getAttribute('aria-label');

      if (itemLabel === label) {
        return index;
      }
    }

    return -1;
  };

  const expectMenuOpenedWithFocusInside = async (): Promise<void> => {
    await expectMenuOpen();
    await expect.poll(getFocusedItemIndex).toBeGreaterThanOrEqual(0);
  };

  return {
    closeMenuWithEscape,
    async expectAllPersonasListed(): Promise<void> {
      await openMenuWithClick();
      await expect(personaItems).toHaveCount(PERSONA_COUNT);

      for (const { group, personas } of PERSONA_GROUPS) {
        await expect(menu.getByText(getGroupTitle(group), { exact: true })).toBeVisible();
        await expect(getPersonaGroup(group).getByRole('menuitemradio')).toHaveCount(PERSONAS_PER_GROUP);

        for (const persona of personas) {
          await expect(getPersonaGroup(group).getByRole('menuitemradio', {
            exact: true,
            name: getPersonaLabel(persona),
          })).toBeVisible();
        }
      }

      await closeMenuWithEscape();
    },
    async expectCheckedPersona(persona: PersonaValue): Promise<void> {
      await expect(getPersonaItem(persona)).toHaveAttribute('aria-checked', 'true');
      await expect(personaItems.and(page.locator('[aria-checked="true"]'))).toHaveCount(1);
    },
    async expectCurrentPersona(persona: PersonaValue): Promise<void> {
      await expectSwitcherReady();
      await expect(trigger).toHaveAccessibleName(getProfileButtonLabel(persona));
      await expect(trigger.getByText(persona.initials, { exact: true })).toBeVisible();
      await expect(banner.getByText(getText('app.productName'), { exact: true })).toBeVisible();
    },
    expectMenuClosed,
    expectMenuOpen,
    expectMenuOpenedWithFocusInside,
    expectPersonasLoaded,
    async expectSectionHeading(section: SectionValue): Promise<void> {
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(getSectionTitle(section));
    },
    async expectSections(sections: readonly SectionValue[]): Promise<void> {
      await expect(navigation.getByRole('link')).toHaveText(sections.map(getSectionTitle));
    },
    async expectSwitchAnnounced(persona: PersonaValue): Promise<void> {
      await expect(page.getByRole('status').filter({ hasText: getSwitchedAnnouncement(persona) })).toHaveCount(1);
    },
    expectSwitcherReady,
    expectTriggerFocused,
    focusTrigger,
    async focusTriggerWithTab(): Promise<void> {
      await expectSwitcherReady();

      for (const key of TAB_KEYS) {
        for (let press = 0; press < MAX_TAB_PRESSES; press += 1) {
          await page.keyboard.press(key);

          const focusedTriggerCount = await trigger.and(page.locator(':focus')).count();

          if (focusedTriggerCount > 0) {
            await expectTriggerFocused();

            return;
          }
        }
      }

      await expectTriggerFocused();
    },
    async highlightPersonaWithArrows(persona: PersonaValue): Promise<void> {
      await expectPersonasLoaded();

      const targetIndex = await getItemIndex(persona);
      const focusedIndex = await getFocusedItemIndex();

      expect(targetIndex).toBeGreaterThanOrEqual(0);

      if (targetIndex >= focusedIndex) {
        await pressArrowInMenu('ArrowDown', targetIndex - focusedIndex);
      }
      else {
        await pressArrowInMenu('ArrowUp', focusedIndex - targetIndex);
      }

      await expect(getPersonaItem(persona)).toBeFocused();
    },
    async openAsPersona(hash: string, personaId: string): Promise<void> {
      await page.goto(`/${hash}?as=${personaId}`);
    },
    async openMenuWithArrowDown(): Promise<void> {
      await focusTrigger();
      await page.keyboard.press('ArrowDown');
      await expectMenuOpenedWithFocusInside();
      await expectPersonasLoaded();
    },
    openMenuWithClick,
    async openMenuWithEnter(): Promise<void> {
      await focusTrigger();
      await page.keyboard.press('Enter');
      await expectMenuOpenedWithFocusInside();
      await expectPersonasLoaded();
    },
    async pressArrowDownInMenu(times: number): Promise<void> {
      await pressArrowInMenu('ArrowDown', times);
    },
    async pressArrowUpInMenu(times: number): Promise<void> {
      await pressArrowInMenu('ArrowUp', times);
    },
    async pressEnterOnHighlightedPersona(): Promise<void> {
      await page.keyboard.press('Enter');
    },
    async selectPersona(persona: PersonaValue): Promise<void> {
      await openMenuWithClick();
      await getPersonaItem(persona).click();
      await expectMenuClosed();
      await expect(trigger).toHaveAccessibleName(getProfileButtonLabel(persona));
      await expectSwitcherReady();
    },
  };
};
