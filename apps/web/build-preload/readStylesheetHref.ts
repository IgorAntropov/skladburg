const LINK_TAG_PATTERN = /<link\b[^>]*>/gi;

const HREF_PATTERN = /\shref="([^"]*)"/i;

const REL_PATTERN = /\srel="([^"]*)"/i;

const STYLESHEET_REL = 'stylesheet';

export const readStylesheetHref = (html: string): string | undefined => {
  for (const [tag] of html.matchAll(LINK_TAG_PATTERN)) {
    const isStylesheet = REL_PATTERN.exec(tag)?.[1]?.toLowerCase().split(/\s+/).includes(STYLESHEET_REL) === true;
    const href = HREF_PATTERN.exec(tag)?.[1];

    if (isStylesheet && href !== undefined) {
      return href;
    }
  }

  return undefined;
};
