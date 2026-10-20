import type { Page } from '@playwright/test';

import { AxeBuilder } from '@axe-core/playwright';
import { expect } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

export const expectNoAxeViolations = async (page: Page): Promise<void> => {
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();

  expect(violations.map(violation => ({
    id: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map(node => node.target.map(String).join(' ')),
  }))).toEqual([]);
};
