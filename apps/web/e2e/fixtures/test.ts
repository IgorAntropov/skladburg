import { test as base } from '@playwright/test';

import type { GraphicsPreferenceValue } from './graphicsPreference.ts';

import { createStoreGraphicsPreferenceIfAbsentScript } from './graphicsPreference.ts';

interface GraphicsOptionsValue {
  initialGraphicsPreference: GraphicsPreferenceValue | null;
}

export const test = base.extend<GraphicsOptionsValue>({
  initialGraphicsPreference: ['off', { option: true }],
  page: async ({ initialGraphicsPreference, page }, provide) => {
    if (initialGraphicsPreference !== null) {
      await page.addInitScript({ content: createStoreGraphicsPreferenceIfAbsentScript(initialGraphicsPreference) });
    }

    await provide(page);
  },
});

export { expect } from '@playwright/test';
