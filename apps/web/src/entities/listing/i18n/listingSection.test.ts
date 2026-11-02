import {
  describe,
  expect,
  it,
} from 'vitest';

import { findSectionKeyConflicts } from '@/shared/i18n/index.testing';

import { listingSection } from './listingSection';

describe('listing section', () => {
  it('keeps the keys under the listing prefix and apart from the main catalog', async () => {
    expect(await findSectionKeyConflicts(listingSection)).toEqual([]);
  });
});
