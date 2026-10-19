import {
  describe,
  expect,
  it,
} from 'vitest';

import { resolveDeferredTriggerSelectors } from './resolveDeferredTrigger.ts';

const ENTRY_SELECTOR = 'script[src="/app/assets/index.js"]';

describe('resolveDeferredTriggerSelectors', () => {
  it('waits for the stylesheet and the entry script', () => {
    expect(resolveDeferredTriggerSelectors({ entryHref: '/app/assets/index.js', stylesheetHref: '/app/assets/index.css' })).toEqual([
      'link[href="/app/assets/index.css"]',
      ENTRY_SELECTOR,
    ]);
  });

  it('waits for the entry script only when the page has no stylesheet', () => {
    expect(resolveDeferredTriggerSelectors({ entryHref: '/app/assets/index.js', stylesheetHref: undefined })).toEqual([ENTRY_SELECTOR]);
  });
});
