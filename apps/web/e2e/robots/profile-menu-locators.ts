import type {
  Locator,
  Page,
} from '@playwright/test';

import type { PersonaValue } from '../fixtures/demoData.ts';

export interface ProfileMenuLocatorsValue {
  autoGraphicsLevel: Locator;
  button: Locator;
  getGraphicsOption: (preference: string) => Locator;
  getPersonaAvatarImage: (persona: PersonaValue) => Locator;
  getPersonaItem: (persona: PersonaValue) => Locator;
  header: Locator;
  headerAvatarImage: Locator;
  menu: Locator;
  myProfileItem: Locator;
  resetItem: Locator;
}

export const createProfileMenuLocators = (page: Page): ProfileMenuLocatorsValue => ({
  autoGraphicsLevel: page.getByTestId('graphics-menu-option-auto').getByTestId('graphics-menu-auto-level'),
  button: page.getByTestId('profile-button'),
  getGraphicsOption: (preference: string): Locator => page.getByTestId(`graphics-menu-option-${preference}`),
  getPersonaAvatarImage: ({ id }: PersonaValue): Locator => page.getByTestId(`profile-menu-persona-${id}`).locator('img'),
  getPersonaItem: ({ id }: PersonaValue): Locator => page.getByTestId(`profile-menu-persona-${id}`),
  header: page.getByTestId('profile-menu-header'),
  headerAvatarImage: page.getByTestId('profile-menu-header').locator('img'),
  menu: page.getByTestId('profile-menu'),
  myProfileItem: page.getByTestId('profile-menu-my-profile'),
  resetItem: page.getByTestId('profile-menu-reset'),
});
