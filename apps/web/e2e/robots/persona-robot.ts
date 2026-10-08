import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type { PersonaValue } from '../fixtures/demoData.ts';
import type { SectionValue } from '../fixtures/routes.ts';

import { PERSONA_COUNT } from '../fixtures/demoData.ts';
import { getText } from '../fixtures/messages.ts';
import { getSectionTitle } from '../fixtures/routes.ts';

const getPersonaLabel = ({ kind, organizationName }: PersonaValue): string => getText('persona.option')
  .replace('{kind}', getText(`persona.kind.${kind}`))
  .replace('{organization}', organizationName);

const getTriggerLabel = (persona: PersonaValue): string => getText('persona.trigger.label')
  .replace('{persona}', getPersonaLabel(persona));

const getTriggerLabelPrefix = (): string => getText('persona.trigger.label').replace('{persona}', '');

export interface PersonaRobotValue {
  closeMenuWithEscape: () => Promise<void>;
  expectAllPersonasListed: () => Promise<void>;
  expectBrand: (organizationName: string) => Promise<void>;
  expectCheckedPersona: (persona: PersonaValue) => Promise<void>;
  expectCurrentPersona: (persona: PersonaValue) => Promise<void>;
  expectMenuClosed: () => Promise<void>;
  expectMenuOpen: () => Promise<void>;
  expectSectionHeading: (section: SectionValue) => Promise<void>;
  expectSections: (sections: readonly SectionValue[]) => Promise<void>;
  expectSwitcherReady: () => Promise<void>;
  expectTriggerFocused: () => Promise<void>;
  focusTrigger: () => Promise<void>;
  highlightPersonaWithArrows: (persona: PersonaValue) => Promise<void>;
  openAsPersona: (hash: string, personaId: string) => Promise<void>;
  openMenuWithArrowDown: () => Promise<void>;
  openMenuWithClick: () => Promise<void>;
  pressArrowDownInMenu: (times: number) => Promise<void>;
  pressArrowUpInMenu: (times: number) => Promise<void>;
  pressEnterOnHighlightedPersona: () => Promise<void>;
  selectPersona: (persona: PersonaValue) => Promise<void>;
}

export const createPersonaRobot = (page: Page): PersonaRobotValue => {
  const banner = page.getByRole('banner');
  const main = page.getByRole('main');
  const navigation = page.getByRole('navigation', { name: getText('app.nav.label') });
  const trigger: Locator = banner.getByRole('button', { name: getTriggerLabelPrefix() });
  const menu: Locator = page.getByRole('menu', { name: getText('persona.label') });
  const menuItems: Locator = menu.getByRole('menuitemradio');
  const getMenuItem = (persona: PersonaValue): Locator => menu.getByRole('menuitemradio', {
    exact: true,
    name: getPersonaLabel(persona),
  });

  const expectSwitcherReady = async (): Promise<void> => {
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeEnabled();
    await expect(trigger).not.toHaveAttribute('aria-busy', 'true');
  };

  const expectBrand = async (organizationName: string): Promise<void> => {
    await expect(banner.getByText(organizationName, { exact: true })).toBeVisible();
  };

  const expectMenuOpen = async (): Promise<void> => {
    await expect(menu).toBeVisible();
  };

  const expectMenuClosed = async (): Promise<void> => {
    await expect(menu).toHaveCount(0);
  };

  const expectTriggerFocused = async (): Promise<void> => {
    await expect(trigger).toBeFocused();
  };

  const closeMenuWithEscape = async (): Promise<void> => {
    await page.keyboard.press('Escape');
    await expectMenuClosed();
  };

  const openMenuWithClick = async (): Promise<void> => {
    await expectSwitcherReady();
    await trigger.click();
    await expectMenuOpen();
  };

  const focusTrigger = async (): Promise<void> => {
    await expectSwitcherReady();
    await trigger.focus();
    await expectTriggerFocused();
  };

  const openMenuWithArrowDown = async (): Promise<void> => {
    await focusTrigger();
    await page.keyboard.press('ArrowDown');
    await expectMenuOpen();
    await expect(menuItems.first()).toBeFocused();
  };

  const getFocusedItemIndex = async (): Promise<number> => {
    const itemCount = await menuItems.count();

    for (let index = 0; index < itemCount; index += 1) {
      const focusedCount = await menuItems.nth(index).and(page.locator(':focus')).count();

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
    const labels = await menuItems.allInnerTexts();

    return labels.findIndex(label => label.trim() === getPersonaLabel(persona));
  };

  return {
    closeMenuWithEscape,
    async expectAllPersonasListed(): Promise<void> {
      await openMenuWithClick();
      await expect(menuItems).toHaveCount(PERSONA_COUNT);
      await closeMenuWithEscape();
    },
    expectBrand,
    async expectCheckedPersona(persona: PersonaValue): Promise<void> {
      await expect(getMenuItem(persona)).toHaveAttribute('aria-checked', 'true');
      await expect(menu.locator('[role="menuitemradio"][aria-checked="true"]')).toHaveCount(1);
    },
    async expectCurrentPersona(persona: PersonaValue): Promise<void> {
      await expectSwitcherReady();
      await expect(trigger).toHaveAccessibleName(getTriggerLabel(persona));
      await expectBrand(persona.organizationName);
    },
    expectMenuClosed,
    expectMenuOpen,
    async expectSectionHeading(section: SectionValue): Promise<void> {
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(getSectionTitle(section));
    },
    async expectSections(sections: readonly SectionValue[]): Promise<void> {
      await expect(navigation.getByRole('link')).toHaveText(sections.map(getSectionTitle));
    },
    expectSwitcherReady,
    expectTriggerFocused,
    focusTrigger,
    async highlightPersonaWithArrows(persona: PersonaValue): Promise<void> {
      const targetIndex = await getItemIndex(persona);
      const focusedIndex = await getFocusedItemIndex();

      expect(targetIndex).toBeGreaterThanOrEqual(0);

      if (targetIndex >= focusedIndex) {
        await pressArrowInMenu('ArrowDown', targetIndex - focusedIndex);
      }
      else {
        await pressArrowInMenu('ArrowUp', focusedIndex - targetIndex);
      }

      await expect(getMenuItem(persona)).toBeFocused();
    },
    async openAsPersona(hash: string, personaId: string): Promise<void> {
      await page.goto(`/${hash}?as=${personaId}`);
    },
    openMenuWithArrowDown,
    openMenuWithClick,
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
      await getMenuItem(persona).click();
      await expectMenuClosed();
      await expect(trigger).toHaveAccessibleName(getTriggerLabel(persona));
      await expectSwitcherReady();
      await expectBrand(persona.organizationName);
    },
  };
};
