const LINKED_HREF_PATTERN = /<(?:link|script)\b[^>]*?\s(?:href|src)="([^"]*)"/gi;

export const readLinkedHrefs = (html: string): Set<string> =>
  new Set([...html.matchAll(LINKED_HREF_PATTERN)].flatMap(match => match[1] === undefined ? [] : [match[1]]));
