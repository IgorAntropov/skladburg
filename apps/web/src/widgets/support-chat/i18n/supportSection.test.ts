import {
  describe,
  expect,
  it,
} from 'vitest';

import { findSectionKeyConflicts } from '@/shared/i18n/index.testing';

import {
  supportInformalSection,
  supportSection,
} from './supportSection';

describe('support sections', () => {
  it('keeps the formal keys under the support prefix and apart from the main catalog', async () => {
    expect(await findSectionKeyConflicts(supportSection)).toEqual([]);
  });

  it('keeps the informal keys under the support prefix and apart from the main catalog', async () => {
    expect(await findSectionKeyConflicts(supportInformalSection)).toEqual([]);
  });

  it('gives the informal section the same keys as the formal one', async () => {
    const formal = await supportSection.load('ru');
    const informal = await supportInformalSection.load('ru');

    expect(Object.keys(informal).sort()).toEqual(Object.keys(formal).sort());
  });
});
