import {
  describe,
  expect,
  it,
} from 'vitest';

import { findSectionKeyConflicts } from '@/shared/i18n/index.testing';

import { catalogSection } from './catalogSection';

describe('catalog section', () => {
  it('keeps the keys under the catalog prefix and apart from the main catalog', async () => {
    expect(await findSectionKeyConflicts(catalogSection)).toEqual([]);
  });
});
