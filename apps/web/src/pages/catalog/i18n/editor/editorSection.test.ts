import {
  describe,
  expect,
  it,
} from 'vitest';

import { findSectionKeyConflicts } from '@/shared/i18n/index.testing';

import { catalogSection } from '../catalogSection';
import { catalogEditorSection } from './editorSection';

describe('catalog editor section', () => {
  it('keeps the keys under the catalog editor prefix and apart from the main catalog', async () => {
    expect(await findSectionKeyConflicts(catalogEditorSection)).toEqual([]);
  });

  it('shares no key with the catalog section', async () => {
    const editorCatalog = await catalogEditorSection.load('ru');
    const pageCatalog = await catalogSection.load('ru');

    expect(Object.keys(editorCatalog).filter(key => Object.hasOwn(pageCatalog, key))).toEqual([]);
  });
});
