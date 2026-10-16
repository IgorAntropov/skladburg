import {
  describe,
  expect,
  it,
} from 'vitest';

import type { DeferredTriggerInputValue } from './resolveDeferredTrigger.ts';

import {
  readPreloadTriggerKey,
  resolveDeferredTriggerSelectors,
} from './resolveDeferredTrigger.ts';

const ENTRY_SELECTOR = 'script[src="/app/assets/index.js"]';

const resolve = (overrides: Partial<DeferredTriggerInputValue> = {}): string[] =>
  resolveDeferredTriggerSelectors({
    entryHref: '/app/assets/index.js',
    pageHrefs: new Set(['/app/assets/mount.js']),
    rootHrefs: ['/app/assets/mount.js'],
    stylesheetHref: '/app/assets/index.css',
    trigger: 'stylesheet-or-entry',
    ...overrides,
  });

describe('resolveDeferredTriggerSelectors', () => {
  it('waits for the entry script only with the entry trigger however many stylesheets the page has', () => {
    expect(resolve({ trigger: 'entry' })).toEqual([ENTRY_SELECTOR]);
  });

  it('waits for the stylesheet and the entry script with the stylesheet trigger', () => {
    expect(resolve()).toEqual(['link[href="/app/assets/index.css"]', ENTRY_SELECTOR]);
  });

  it('waits for the entry script only when the page has no stylesheet', () => {
    expect(resolve({ stylesheetHref: undefined })).toEqual([ENTRY_SELECTOR]);
  });

  it('waits for the module preload of the point and the entry script with the preload trigger', () => {
    expect(resolve({ trigger: { preloadOf: 'src/mountApp.ts' } })).toEqual([
      'link[href="/app/assets/mount.js"]',
      ENTRY_SELECTOR,
    ]);
  });

  it('takes the first root of the point that has a link on the page', () => {
    expect(
      resolve({ rootHrefs: ['/app/assets/hidden.js', '/app/assets/mount.js'], trigger: { preloadOf: 'src/mountApp.ts' } }),
    ).toEqual(['link[href="/app/assets/mount.js"]', ENTRY_SELECTOR]);
  });

  it('fails when the point of the preload trigger has no link on the page', () => {
    expect(() => resolve({ pageHrefs: new Set(), trigger: { preloadOf: 'src/mountApp.ts' } })).toThrow(
      'Critical preload: deferredTrigger names src/mountApp.ts which has no module preload link on the page',
    );
    expect(() => resolve({ rootHrefs: [], trigger: { preloadOf: 'src/mountApp.ts' } })).toThrow('src/mountApp.ts');
  });
});

describe('readPreloadTriggerKey', () => {
  it('names the point only for the preload trigger', () => {
    expect(readPreloadTriggerKey('entry')).toBeUndefined();
    expect(readPreloadTriggerKey('stylesheet-or-entry')).toBeUndefined();
    expect(readPreloadTriggerKey({ preloadOf: 'src/mountApp.ts' })).toBe('src/mountApp.ts');
  });
});
