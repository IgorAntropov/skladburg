import type { Product } from '@skladburg/contracts/catalog/v1/catalog';

import { compareIds } from '../../state/index';

const QUERY_LOCALE = 'ru';
const nameCollator = new Intl.Collator(QUERY_LOCALE);

export const isCatalogQueryMatched = (product: Product, query: string): boolean => {
  const normalized = query.trim().toLocaleLowerCase(QUERY_LOCALE);

  if (normalized === '') {
    return true;
  }

  return product.name.toLocaleLowerCase(QUERY_LOCALE).includes(normalized)
    || product.sku.toLocaleLowerCase(QUERY_LOCALE).includes(normalized);
};

export const compareProductsByName = (current: Product, prev: Product): number => {
  const byName = nameCollator.compare(current.name, prev.name);

  if (byName !== 0) {
    return byName;
  }

  return compareIds(current.id, prev.id);
};
