import {
  describe,
  expect,
  it,
} from 'vitest';

import type { TabsItemValue } from '@/shared/ui';

import { hasLists } from './hasLists';

const HEADER_TEXT = 'Header';

const TAB: TabsItemValue = { content: null, id: 'deals', label: 'Deals' };

describe('hasLists', () => {
  it('has no lists without tabs and without a header', () => {
    expect(hasLists({})).toBe(false);
    expect(hasLists({ listsHeader: undefined, listTabs: undefined })).toBe(false);
  });

  it('has no lists for an empty set of tabs and an empty header', () => {
    expect(hasLists({ listsHeader: false, listTabs: [] })).toBe(false);
    expect(hasLists({ listsHeader: null, listTabs: [] })).toBe(false);
  });

  it('has lists with at least one tab', () => {
    expect(hasLists({ listTabs: [TAB] })).toBe(true);
  });

  it('has lists with a header only', () => {
    expect(hasLists({ listsHeader: <p>{HEADER_TEXT}</p> })).toBe(true);
  });
});
