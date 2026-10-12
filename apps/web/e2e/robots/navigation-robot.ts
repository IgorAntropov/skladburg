import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type {
  ObjectRouteValue,
  SectionValue,
} from '../fixtures/routes.ts';

import { getText } from '../fixtures/messages.ts';
import {
  FIRST_SECTION,
  getSectionTitle,
  SECTIONS,
  toObjectHash,
  toSectionHash,
} from '../fixtures/routes.ts';

const getNotFoundActionText = (): string => getText('routing.notFound.action').replace(
  '{section}',
  getSectionTitle(FIRST_SECTION),
);

export interface NavigationRobotValue {
  clickNotFoundAction: () => Promise<void>;
  expectAddress: (hash: string) => Promise<void>;
  expectAvailableSections: (sections: readonly SectionValue[]) => Promise<void>;
  expectNotFound: () => Promise<void>;
  expectObjectNote: (route: ObjectRouteValue) => Promise<void>;
  expectSection: (section: SectionValue) => Promise<void>;
  openHash: (hash: string) => Promise<void>;
  openObject: (route: ObjectRouteValue) => Promise<void>;
  openRoot: () => Promise<void>;
  openSection: (section: SectionValue) => Promise<void>;
  reload: () => Promise<void>;
}

export const createNavigationRobot = (page: Page): NavigationRobotValue => {
  const main = page.getByRole('main');
  const navigation = page.getByRole('navigation', { name: getText('app.nav.label') });
  const getSectionLink = (section: SectionValue): Locator => navigation.getByRole('link', {
    exact: true,
    name: getSectionTitle(section),
  });

  return {
    async clickNotFoundAction(): Promise<void> {
      await main.getByRole('link', { name: getNotFoundActionText() }).click();
    },
    async expectAddress(hash: string): Promise<void> {
      await expect.poll(() => new URL(page.url()).hash).toBe(hash);
    },
    async expectAvailableSections(sections: readonly SectionValue[]): Promise<void> {
      for (const section of SECTIONS) {
        if (sections.includes(section)) {
          await expect(getSectionLink(section)).toBeVisible();
        }
        else {
          await expect(getSectionLink(section)).toHaveCount(0);
        }
      }
    },
    async expectNotFound(): Promise<void> {
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(getText('routing.notFound.title'));
      await expect(main.getByRole('link', { name: getNotFoundActionText() })).toBeVisible();
    },
    async expectObjectNote({ id }: ObjectRouteValue): Promise<void> {
      await expect(main.getByText(id, { exact: true })).toBeVisible();
    },
    async expectSection(section: SectionValue): Promise<void> {
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(getSectionTitle(section));
      await expect(getSectionLink(section)).toHaveAttribute('aria-current', 'page');
    },
    async openHash(hash: string): Promise<void> {
      await page.goto(`/${hash}`);
    },
    async openObject(route: ObjectRouteValue): Promise<void> {
      await page.goto(`/${toObjectHash(route)}`);
    },
    async openRoot(): Promise<void> {
      await page.goto('/');
    },
    async openSection(section: SectionValue): Promise<void> {
      await page.goto(`/${toSectionHash(section)}`);
    },
    async reload(): Promise<void> {
      await page.reload();
    },
  };
};
