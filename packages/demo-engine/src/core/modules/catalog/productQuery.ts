import type { Product } from '@skladburg/contracts/catalog/v1/catalog';
import type { SearchQueryValue } from '@skladburg/contracts/runtime';

import { isSearchQueryMatched } from '@skladburg/contracts/runtime';

import { compareIds } from '../../state/index';

const QUERY_LOCALE = 'ru';
const nameCollator = new Intl.Collator(QUERY_LOCALE);

export const isCatalogQueryMatched = (product: Product, query: SearchQueryValue): boolean =>
  isSearchQueryMatched(query, [product.name, product.sku], product.gtin);

export const compareProductsByName = (current: Product, prev: Product): number => {
  const byName = nameCollator.compare(current.name, prev.name);

  if (byName !== 0) {
    return byName;
  }

  return compareIds(current.id, prev.id);
};
