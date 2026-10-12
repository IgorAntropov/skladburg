import type {
  Locator,
  Page,
} from '@playwright/test';

import type { PersonaValue } from '../fixtures/demoData.ts';

import { getText } from '../fixtures/messages.ts';
import { getPersonaLabel } from '../fixtures/personaLabels.ts';

export interface ProfileMenuLocatorsValue {
  button: Locator;
  getPersonaItem: (persona: PersonaValue) => Locator;
  menu: Locator;
  resetItem: Locator;
}

export const createProfileMenuLocators = (page: Page): ProfileMenuLocatorsValue => {
  const menu = page.getByRole('menu', { name: getText('profile.menu.label') });

  return {
    button: page.getByRole('banner').getByRole('button').and(page.locator('[aria-haspopup="menu"]')),
    getPersonaItem: (persona: PersonaValue): Locator => menu.getByRole('menuitemradio', {
      exact: true,
      name: getPersonaLabel(persona),
    }),
    menu,
    resetItem: menu.getByRole('menuitem', { exact: true, name: getText('demo.reset.menuItem') }),
  };
};
