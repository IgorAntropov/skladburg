import {
  describe,
  expect,
  it,
} from 'vitest';

import type { CatalogShapeValue } from './messageShape';

import { catalog as referenceCatalog } from '../catalogs/ru';
import { extractPlaceholders } from './messageShape';

interface CatalogModuleValue {
  catalog: CatalogShapeValue;
}

const catalogModules = import.meta.glob<CatalogModuleValue>('../catalogs/*.ts', { eager: true });

const catalogEntries = Object.entries(catalogModules).map(([path, module]): [string, CatalogShapeValue] => {
  const locale = path.replace(/^.*\/([^/]+)\.ts$/, '$1');

  return [locale, module.catalog];
});

describe('locale catalogs', () => {
  it('contains the reference catalog', () => {
    expect(catalogEntries.map(([locale]) => locale)).toContain('ru');
  });

  describe.each(catalogEntries)('catalog %s', (locale, catalog) => {
    it('has the same keys as the reference catalog', () => {
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(referenceCatalog).sort());
    });

    it('has the same message kinds and placeholders as the reference catalog', () => {
      for (const [key, referenceMessage] of Object.entries(referenceCatalog)) {
        const message = catalog[key];

        expect(message, key).toBeDefined();

        if (message === undefined) {
          continue;
        }

        expect(typeof message, key).toBe(typeof referenceMessage);
        expect(extractPlaceholders(message), key).toEqual(extractPlaceholders(referenceMessage));
      }
    });

    it('has exactly the plural categories of the locale', () => {
      const expectedCategories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories.sort();

      for (const [key, message] of Object.entries(catalog)) {
        if (typeof message !== 'string') {
          expect(Object.keys(message).sort(), key).toEqual(expectedCategories);
        }
      }
    });
  });
});
