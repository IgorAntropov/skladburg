import {
  describe,
  expect,
  it,
} from 'vitest';

import { findSectionKeyConflicts } from '@/shared/i18n/index.testing';

import { notificationSection } from './notificationSection';

describe('notificationSection', () => {
  it('keeps its keys under its own prefix and apart from the main catalog', async () => {
    expect(await findSectionKeyConflicts(notificationSection)).toEqual([]);
  });
});
