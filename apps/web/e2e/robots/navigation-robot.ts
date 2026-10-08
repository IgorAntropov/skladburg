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
  SECTIONS,
  toObjectHash,
  toSectionHash,
} from '../fixtures/routes.ts';

const PLACEHOLDER_KEYS = {
  catalog: 'section.catalog.placeholder',
  deals: 'section.deals.placeholder',
  network: 'section.network.placeholder',
  warehouse: 'warehouse.placeholder',
} as const;

const getSectionTitle = (section: SectionValue): string => getText(`section.${section}.title`);

const getNotFoundActionText = (): string => getText('routing.notFound.action').replace(
  '{section}',
  getSectionTitle(FIRST_SECTION),
);

const getFocusedObjectLabel = ({ type }: ObjectRouteValue): string => getText('routing.focusedObject').replace(
  '{type}',
  getText(`object.type.${type}`),
);

export interface NavigationRobotValue {
  clickNotFoundAction: () => Promise<void>;
  clickSectionLink: (section: SectionValue) => Promise<void>;
  expectAddress: (hash: string) => Promise<void>;
  expectBlankPage: () => Promise<void>;
  expectNoObjectNote: () => Promise<void>;
  expectNotFound: () => Promise<void>;
  expectObjectNote: (route: ObjectRouteValue) => Promise<void>;
  expectSection: (section: SectionValue) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
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
    async clickSectionLink(section: SectionValue): Promise<void> {
      await getSectionLink(section).click();
    },
    async expectAddress(hash: string): Promise<void> {
      await expect.poll(() => new URL(page.url()).hash).toBe(hash);
    },
    async expectBlankPage(): Promise<void> {
      await expect.poll(() => page.url()).toBe('about:blank');
    },
    async expectNoObjectNote(): Promise<void> {
      const label = getText('routing.focusedObject').split(':')[0] ?? '';

      await expect(main.getByText(label)).toHaveCount(0);
    },
    async expectNotFound(): Promise<void> {
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(getText('routing.notFound.title'));
      await expect(main.getByRole('link', { name: getNotFoundActionText() })).toBeVisible();
      await expect(navigation.locator('[aria-current]')).toHaveCount(0);
      await expect(page).toHaveTitle(new RegExp(`^${getText('routing.notFound.title')} · `));
    },
    async expectObjectNote(route: ObjectRouteValue): Promise<void> {
      const identifier = main.getByText(route.id, { exact: true });

      await expect(identifier).toBeVisible();
      await expect(identifier).toHaveAttribute('translate', 'no');
      await expect(identifier.locator('xpath=..')).toHaveText(`${getFocusedObjectLabel(route)} ${route.id}`);
    },
    async expectSection(section: SectionValue): Promise<void> {
      const title = getSectionTitle(section);

      await expect(main).toBeVisible();

      for (const candidate of SECTIONS) {
        const link = getSectionLink(candidate);

        if (candidate === section) {
          await expect(link).toHaveAttribute('aria-current', 'page');
        }
        else {
          await expect(link).not.toHaveAttribute('aria-current', /.*/);
        }
      }

      await expect(main.getByRole('heading', { level: 1 })).toHaveText(title);
      await expect(main.getByText(getText(PLACEHOLDER_KEYS[section]))).toBeVisible();

      await expect(page).toHaveTitle(new RegExp(`^${title} · `));
    },
    async goBack(): Promise<void> {
      await page.goBack();
    },
    async goForward(): Promise<void> {
      await page.goForward();
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
