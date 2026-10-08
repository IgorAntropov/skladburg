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

export interface PersonaRobotValue {
  expectAllPersonasListed: () => Promise<void>;
  expectBrand: (organizationName: string) => Promise<void>;
  expectCurrentPersona: (persona: PersonaValue) => Promise<void>;
  expectSectionHeading: (section: SectionValue) => Promise<void>;
  expectSections: (sections: readonly SectionValue[]) => Promise<void>;
  expectSwitcherReady: () => Promise<void>;
  openAsPersona: (hash: string, personaId: string) => Promise<void>;
  selectPersona: (persona: PersonaValue) => Promise<void>;
}

export const createPersonaRobot = (page: Page): PersonaRobotValue => {
  const banner = page.getByRole('banner');
  const main = page.getByRole('main');
  const navigation = page.getByRole('navigation', { name: getText('app.nav.label') });
  const switcher: Locator = banner.getByLabel(getText('persona.label'));

  const expectSwitcherReady = async (): Promise<void> => {
    await expect(switcher).toBeEnabled();
    await expect(switcher).toHaveAttribute('aria-busy', 'false');
  };

  const expectBrand = async (organizationName: string): Promise<void> => {
    await expect(banner.getByText(organizationName, { exact: true })).toBeVisible();
  };

  return {
    async expectAllPersonasListed(): Promise<void> {
      await expectSwitcherReady();
      await expect(switcher.getByRole('option')).toHaveCount(PERSONA_COUNT);
    },
    expectBrand,
    async expectCurrentPersona(persona: PersonaValue): Promise<void> {
      await expectSwitcherReady();
      await expect(switcher).toHaveValue(persona.id);
      await expectBrand(persona.organizationName);
    },
    async expectSectionHeading(section: SectionValue): Promise<void> {
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(getSectionTitle(section));
    },
    async expectSections(sections: readonly SectionValue[]): Promise<void> {
      await expect(navigation.getByRole('link')).toHaveText(sections.map(getSectionTitle));
    },
    expectSwitcherReady,
    async openAsPersona(hash: string, personaId: string): Promise<void> {
      await page.goto(`/${hash}?as=${personaId}`);
    },
    async selectPersona(persona: PersonaValue): Promise<void> {
      await expectSwitcherReady();
      await switcher.selectOption({ label: getPersonaLabel(persona) });
      await expect(switcher).toHaveValue(persona.id);
      await expectSwitcherReady();
      await expectBrand(persona.organizationName);
    },
  };
};
