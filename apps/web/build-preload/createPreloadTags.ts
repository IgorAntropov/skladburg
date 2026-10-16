import type { HtmlTagDescriptor } from 'vite';

export interface PreloadTagsOptionsValue {
  base: string;
  fileNames: readonly string[];
  isLowPriority: boolean;
}

const LOW_FETCH_PRIORITY = 'low';

const withTrailingSlash = (base: string): string => (base === '' || base.endsWith('/') ? base : `${base}/`);

export const toPreloadHref = (base: string, fileName: string): string => `${withTrailingSlash(base)}${fileName}`;

export const createPreloadTags = ({ base, fileNames, isLowPriority }: PreloadTagsOptionsValue): HtmlTagDescriptor[] =>
  fileNames.map(fileName => ({
    attrs: {
      crossorigin: true,
      ...isLowPriority ? { fetchpriority: LOW_FETCH_PRIORITY } : {},
      href: toPreloadHref(base, fileName),
      rel: 'modulepreload',
    },
    injectTo: 'head',
    tag: 'link',
  }));

export const createInlineScriptTag = (script: string): HtmlTagDescriptor => ({
  children: script,
  injectTo: 'head',
  tag: 'script',
});
