import type { DeferredTriggerValue } from './criticalPreloadTypes.ts';

import {
  createEntryScriptSelector,
  createLinkSelector,
} from './createDeferredPreloadScript.ts';

export interface DeferredTriggerInputValue {
  entryHref: string;
  pageHrefs: ReadonlySet<string>;
  rootHrefs: readonly string[];
  stylesheetHref: string | undefined;
  trigger: DeferredTriggerValue;
}

export const readPreloadTriggerKey = (trigger: DeferredTriggerValue): string | undefined =>
  typeof trigger === 'string' ? undefined : trigger.preloadOf;

export const resolveDeferredTriggerSelectors = ({
  entryHref,
  pageHrefs,
  rootHrefs,
  stylesheetHref,
  trigger,
}: DeferredTriggerInputValue): string[] => {
  const entrySelector = createEntryScriptSelector(entryHref);

  if (trigger === 'entry') {
    return [entrySelector];
  }

  if (trigger === 'stylesheet-or-entry') {
    return stylesheetHref === undefined ? [entrySelector] : [createLinkSelector(stylesheetHref), entrySelector];
  }

  const preloadHref = rootHrefs.find(href => pageHrefs.has(href));

  if (preloadHref === undefined) {
    throw new Error(`Critical preload: deferredTrigger names ${trigger.preloadOf} which has no module preload link on the page`);
  }

  return [createLinkSelector(preloadHref), entrySelector];
};
