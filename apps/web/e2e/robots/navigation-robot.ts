import type {
  Locator,
  Page,
} from '@playwright/test';

import { expect } from '@playwright/test';

import type {
  ObjectRouteValue,
  SectionValue,
} from '../fixtures/routes.ts';

import {
  SECTIONS,
  toObjectHash,
  toSectionHash,
} from '../fixtures/routes.ts';

export interface NavigationRobotValue {
  clickNotFoundAction: () => Promise<void>;
  clickSection: (section: SectionValue) => Promise<void>;
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
  const notFound = page.getByTestId('not-found');
  const notFoundAction = page.getByTestId('not-found-action');
  const objectNote = page.getByTestId('object-note');
  const getSectionLink = (section: SectionValue): Locator => page.getByTestId(`app-nav-link-${section}`);
  const getSectionPage = (section: SectionValue): Locator => page.getByTestId(`page-${section}`);

  return {
    async clickNotFoundAction(): Promise<void> {
      await notFoundAction.click();
    },
    async clickSection(section: SectionValue): Promise<void> {
      await getSectionLink(section).click();
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
      await expect(notFound).toBeVisible();
      await expect(notFoundAction).toBeVisible();
    },
    async expectObjectNote({ id }: ObjectRouteValue): Promise<void> {
      await expect(objectNote).toContainText(id);
    },
    async expectSection(section: SectionValue): Promise<void> {
      await expect(getSectionPage(section)).toBeVisible();
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
