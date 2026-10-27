import {
  describe,
  expect,
  it,
} from 'vitest';

import { createCatalogSection } from '../createCatalogSection';
import { findSectionKeyConflicts } from './findSectionKeyConflicts';
import {
  createProbeSection,
  ruSectionCatalog,
} from './sectionFixtures';

const sharedKeyCatalog = { 'action.pending': 'Свой текст' } as const;

const strayKeyCatalog = { 'probe.title': 'Заголовок', 'stray.title': 'Чужой' } as const;

describe('findSectionKeyConflicts', () => {
  it('returns nothing for a section with its own prefixed keys', async () => {
    const section = createProbeSection({ ru: () => Promise.resolve(ruSectionCatalog) });

    await expect(findSectionKeyConflicts(section)).resolves.toEqual([]);
  });

  it('reports a key of the main catalog', async () => {
    const section = createCatalogSection<typeof sharedKeyCatalog>({
      loaders: { ru: () => Promise.resolve(sharedKeyCatalog) },
      prefix: 'action',
    });

    await expect(findSectionKeyConflicts(section)).resolves.toEqual(['ru:action.pending']);
  });

  it('reports a key outside of the section prefix', async () => {
    const section = createCatalogSection<typeof strayKeyCatalog>({
      loaders: { ru: () => Promise.resolve(strayKeyCatalog) },
      prefix: 'probe',
    });

    await expect(findSectionKeyConflicts(section)).resolves.toEqual(['ru:stray.title']);
  });
});
