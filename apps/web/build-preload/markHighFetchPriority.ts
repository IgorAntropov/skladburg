const OPENING_TAG_PATTERN = /<(script|link)\b[^>]*>/gi;

const SRC_PATTERN = /\ssrc="([^"]*)"/i;

const HREF_PATTERN = /\shref="([^"]*)"/i;

const REL_PATTERN = /\srel="([^"]*)"/i;

const FETCH_PRIORITY_PATTERN = /\sfetchpriority\s*=/i;

const STYLESHEET_REL = 'stylesheet';

const HIGH_FETCH_PRIORITY_ATTRIBUTE = ' fetchpriority="high"';

export interface HighFetchPriorityResultValue {
  hasEntryScript: boolean;
  html: string;
}

const readAttribute = (tag: string, pattern: RegExp): string | undefined => pattern.exec(tag)?.[1];

const isRenderBlockingStylesheet = (tag: string): boolean =>
  readAttribute(tag, REL_PATTERN)?.toLowerCase().split(/\s+/).includes(STYLESHEET_REL) === true
  && readAttribute(tag, HREF_PATTERN) !== undefined;

const withHighFetchPriority = (tag: string, tagName: string): string =>
  FETCH_PRIORITY_PATTERN.test(tag) ? tag : `<${tagName}${HIGH_FETCH_PRIORITY_ATTRIBUTE}${tag.slice(tagName.length + 1)}`;

export const markHighFetchPriority = (html: string, entryHref: string): HighFetchPriorityResultValue => {
  let hasEntryScript = false;

  const marked = html.replace(OPENING_TAG_PATTERN, (tag, tagName: string) => {
    const isEntryScript = tagName.toLowerCase() === 'script' && readAttribute(tag, SRC_PATTERN) === entryHref;

    if (isEntryScript) {
      hasEntryScript = true;
    }

    return isEntryScript || (tagName.toLowerCase() === 'link' && isRenderBlockingStylesheet(tag))
      ? withHighFetchPriority(tag, tagName)
      : tag;
  });

  return { hasEntryScript, html: marked };
};
