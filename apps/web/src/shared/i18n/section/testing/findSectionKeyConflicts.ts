import type { CatalogShapeValue } from '../../localizer/messageShape';
import type { CatalogSectionValue } from '../sectionTypes';

import { catalog as mainCatalog } from '../../catalogs/ru';

export const findSectionKeyConflicts = async <TCatalog extends CatalogShapeValue>(
  section: CatalogSectionValue<TCatalog>,
): Promise<string[]> => {
  const sectionPrefix = `${section.prefix}.`;
  const conflicts: string[] = [];

  for (const locale of section.locales) {
    const catalog = await section.load(locale);

    for (const key of Object.keys(catalog)) {
      const isForeign = !key.startsWith(sectionPrefix);
      const isShared = Object.hasOwn(mainCatalog, key);

      if (isForeign || isShared) {
        conflicts.push(`${locale}:${key}`);
      }
    }
  }

  return conflicts;
};
