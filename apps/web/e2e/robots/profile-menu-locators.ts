import type {
  Locator,
  Page,
} from '@playwright/test';

import type { PersonaValue } from '../fixtures/demoData.ts';

export interface ProfileMenuLocatorsValue {
  button: Locator;
  getPersonaItem: (persona: PersonaValue) => Locator;
  menu: Locator;
  resetItem: Locator;
}

export const createProfileMenuLocators = (page: Page): ProfileMenuLocatorsValue => ({
  button: page.getByTestId('profile-button'),
  getPersonaItem: ({ id }: PersonaValue): Locator => page.getByTestId(`profile-menu-persona-${id}`),
  menu: page.getByTestId('profile-menu'),
  resetItem: page.getByTestId('profile-menu-reset'),
});
