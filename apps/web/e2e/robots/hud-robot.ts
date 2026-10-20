import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import { expectNoAxeViolations } from '../fixtures/axe.ts';

export interface HudRobotValue {
  expectNoViolationsOfAccessibility: () => Promise<void>;
}

export const createHudRobot = (page: Page): HudRobotValue => {
  const networkPage = page.getByTestId('page-network');

  return {
    async expectNoViolationsOfAccessibility(): Promise<void> {
      await expect(networkPage).toBeVisible();
      await expectNoAxeViolations(page);
    },
  };
};
