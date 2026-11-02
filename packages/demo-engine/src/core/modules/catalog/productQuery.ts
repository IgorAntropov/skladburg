import type { Product } from '@skladburg/contracts/catalog/v1/catalog';

import { compareIds } from '../../state/index';

const QUERY_LOCALE = 'ru';
const nameCollator = new Intl.Collator(QUERY_LOCALE);

export const normalizeCatalogQuery = (query: string): string => query.trim().toLocaleLowerCase(QUERY_LOCALE);

export const isTextIncludingQuery = (text: string, normalizedQuery: string): boolean =>
  text.toLocaleLowerCase(QUERY_LOCALE).includes(normalizedQuery);

export const isCatalogQueryMatched = (product: Product, query: string): boolean => {
  const normalized = normalizeCatalogQuery(query);

  return normalized === ''
    || isTextIncludingQuery(product.name, normalized)
    || isTextIncludingQuery(product.sku, normalized);
};

export const compareProductsByName = (current: Product, prev: Product): number => {
  const byName = nameCollator.compare(current.name, prev.name);

  if (byName !== 0) {
    return byName;
  }

  return compareIds(current.id, prev.id);
};
