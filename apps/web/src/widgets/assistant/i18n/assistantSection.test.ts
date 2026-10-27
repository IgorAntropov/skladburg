import {
  describe,
  expect,
  it,
} from 'vitest';

import { findSectionKeyConflicts } from '@/shared/i18n/index.testing';

import {
  assistantInformalSection,
  assistantSection,
} from './assistantSection';

describe('assistant sections', () => {
  it('keeps the formal keys under the assistant prefix and apart from the main catalog', async () => {
    expect(await findSectionKeyConflicts(assistantSection)).toEqual([]);
  });

  it('keeps the informal keys under the assistant prefix and apart from the main catalog', async () => {
    expect(await findSectionKeyConflicts(assistantInformalSection)).toEqual([]);
  });

  it('gives the informal section the same keys as the formal one', async () => {
    const formal = await assistantSection.load('ru');
    const informal = await assistantInformalSection.load('ru');

    expect(Object.keys(informal).sort()).toEqual(Object.keys(formal).sort());
  });
});
