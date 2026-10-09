import type {
  Locator,
  Page,
} from '@playwright/test';

import type {
  PersonaGroupValue,
  PersonaValue,
} from '../fixtures/demoData.ts';

import { getText } from '../fixtures/messages.ts';
import {
  getGroupLabel,
  getPersonaLabel,
} from '../fixtures/personaLabels.ts';

export type ThemePreferenceValue = 'dark' | 'light' | 'system';

const THEME_LABEL_KEYS = {
  dark: 'theme.dark',
  light: 'theme.light',
  system: 'theme.system',
} as const satisfies Record<ThemePreferenceValue, 'theme.dark' | 'theme.light' | 'theme.system'>;

const escapeRegExp = (text: string): string => text.replace(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);

export const getThemeLabel = (theme: ThemePreferenceValue): string => getText(THEME_LABEL_KEYS[theme]);

export interface ProfileMenuLocatorsValue {
  allItems: Locator;
  banner: Locator;
  button: Locator;
  getPersonaGroup: (group: PersonaGroupValue) => Locator;
  getPersonaItem: (persona: PersonaValue) => Locator;
  getThemeItem: (theme: ThemePreferenceValue) => Locator;
  menu: Locator;
  personaGroups: Locator;
  personaItems: Locator;
  resetItem: Locator;
  sectionsGroup: Locator;
  themeGroup: Locator;
}

export const createProfileMenuLocators = (page: Page): ProfileMenuLocatorsValue => {
  const banner = page.getByRole('banner');
  const button = banner.getByRole('button', { name: getText('profile.button.loading') });
  const menu = page.getByRole('menu', { name: getText('profile.menu.label') });
  const personaGroupPrefix = getText('persona.group.label').replace('{group}', '');
  const personaGroups = menu.getByRole('group', { name: new RegExp(`^${escapeRegExp(personaGroupPrefix)}`) });

  return {
    allItems: menu.locator('[role^="menuitem"]'),
    banner,
    button,
    getPersonaGroup: (group: PersonaGroupValue): Locator => menu.getByRole('group', {
      exact: true,
      name: getGroupLabel(group),
    }),
    getPersonaItem: (persona: PersonaValue): Locator => personaGroups.getByRole('menuitemradio', {
      exact: true,
      name: getPersonaLabel(persona),
    }),
    getThemeItem: (theme: ThemePreferenceValue): Locator => menu
      .getByRole('group', { exact: true, name: getText('theme.label') })
      .getByRole('menuitemradio', { exact: true, name: getThemeLabel(theme) }),
    menu,
    personaGroups,
    personaItems: personaGroups.getByRole('menuitemradio'),
    resetItem: menu.getByRole('menuitem', { exact: true, name: getText('demo.reset.menuItem') }),
    sectionsGroup: menu.getByRole('group', { exact: true, name: getText('app.nav.label') }),
    themeGroup: menu.getByRole('group', { exact: true, name: getText('theme.label') }),
  };
};
