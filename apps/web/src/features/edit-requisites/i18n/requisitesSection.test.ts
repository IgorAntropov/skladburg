import {
  describe,
  expect,
  it,
} from 'vitest';

import { findSectionKeyConflicts } from '@/shared/i18n/index.testing';

import { requisitesSection } from './requisitesSection';

describe('requisites section', () => {
  it('keeps the keys under the requisites prefix and apart from the main catalog', async () => {
    expect(await findSectionKeyConflicts(requisitesSection)).toEqual([]);
  });
});
