import {
  createEntryScriptSelector,
  createLinkSelector,
} from './createDeferredPreloadScript.ts';

export interface DeferredTriggerInputValue {
  entryHref: string;
  stylesheetHref: string | undefined;
}

export const resolveDeferredTriggerSelectors = ({ entryHref, stylesheetHref }: DeferredTriggerInputValue): string[] => {
  const entrySelector = createEntryScriptSelector(entryHref);

  return stylesheetHref === undefined ? [entrySelector] : [createLinkSelector(stylesheetHref), entrySelector];
};
