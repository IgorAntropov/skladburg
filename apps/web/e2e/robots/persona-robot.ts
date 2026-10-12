import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import type { PersonaValue } from '../fixtures/demoData.ts';

import { getProfileButtonLabel } from '../fixtures/personaLabels.ts';
import { createProfileMenuLocators } from './profile-menu-locators.ts';

export interface PersonaRobotValue {
  expectCurrentPersona: (persona: PersonaValue) => Promise<void>;
  openAsPersona: (hash: string, personaId: string) => Promise<void>;
  selectPersona: (persona: PersonaValue) => Promise<void>;
}

export const createPersonaRobot = (page: Page): PersonaRobotValue => {
  const {
    button: trigger,
    getPersonaItem,
    menu,
  } = createProfileMenuLocators(page);

  const expectCurrentPersona = async (persona: PersonaValue): Promise<void> => {
    await expect(trigger).toBeEnabled();
    await expect(trigger).not.toHaveAttribute('aria-busy', 'true');
    await expect(trigger).toHaveAccessibleName(getProfileButtonLabel(persona));
  };

  return {
    expectCurrentPersona,
    async openAsPersona(hash: string, personaId: string): Promise<void> {
      await page.goto(`/${hash}?as=${personaId}`);
    },
    async selectPersona(persona: PersonaValue): Promise<void> {
      await trigger.click();
      await expect(menu).toBeVisible();
      await getPersonaItem(persona).click();
      await expect(menu).toHaveCount(0);
      await expectCurrentPersona(persona);
    },
  };
};
