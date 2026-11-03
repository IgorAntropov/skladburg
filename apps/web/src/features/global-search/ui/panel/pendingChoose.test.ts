import {
  describe,
  expect,
  it,
} from 'vitest';

import type { SearchGroupValue } from '../../model/searchResultTypes';
import type { PendingChooseInputValue } from './pendingChoose';

import {
  isSearchSettled,
  resolvePendingChoose,
} from './pendingChoose';

const createGroup = (status: SearchGroupValue['status'], isStale = false): SearchGroupValue => ({
  error: null,
  hasMore: false,
  id: 'own-listings',
  isStale,
  options: [],
  retry: (): void => undefined,
  status,
});

const createInput = (overrides: Partial<PendingChooseInputValue> = {}): PendingChooseInputValue => ({
  hasOptions: true,
  isSettled: true,
  normalizedQuery: 'теплый',
  pendingChooseQuery: 'Тёплый',
  ...overrides,
});

describe('isSearchSettled', () => {
  it('is settled when no group is loading and the search is not waiting for its sources', () => {
    expect(isSearchSettled({ groups: [createGroup('ready'), createGroup('error')], status: 'ready' })).toBe(true);
    expect(isSearchSettled({ groups: [], status: 'empty' })).toBe(true);
    expect(isSearchSettled({ groups: [], status: 'too-short' })).toBe(true);
  });

  it('is not settled while a group is loading', () => {
    expect(isSearchSettled({ groups: [createGroup('ready'), createGroup('loading')], status: 'ready' })).toBe(false);
  });

  it('is not settled while a group shows the rows of the previous query', () => {
    expect(isSearchSettled({ groups: [createGroup('ready'), createGroup('ready', true)], status: 'ready' })).toBe(false);
  });

  it('is not settled while the sources are still unknown', () => {
    expect(isSearchSettled({ groups: [], status: 'searching' })).toBe(false);
  });
});

describe('resolvePendingChoose', () => {
  it('does nothing when no choice is pending', () => {
    expect(resolvePendingChoose(createInput({ pendingChooseQuery: undefined }))).toBe('none');
  });

  it('waits while the answers have not settled, even when some options are already there', () => {
    expect(resolvePendingChoose(createInput({ isSettled: false }))).toBe('wait');
  });

  it('does not choose the row of the previous query while a group still shows it', () => {
    const search = { groups: [createGroup('ready', true)], status: 'ready' } as const;
    const outcome = resolvePendingChoose(createInput({ isSettled: isSearchSettled(search) }));

    expect(outcome).toBe('wait');
  });

  it('chooses as soon as the answers settle with options', () => {
    expect(resolvePendingChoose(createInput())).toBe('choose');
  });

  it('chooses at once when the choice is set after the answers have settled', () => {
    expect(resolvePendingChoose(createInput({ isSettled: true, pendingChooseQuery: 'теплый' }))).toBe('choose');
  });

  it('gives up when the answers settle empty', () => {
    expect(resolvePendingChoose(createInput({ hasOptions: false }))).toBe('cancel');
  });

  it('cancels a choice made for another query, settled or not', () => {
    expect(resolvePendingChoose(createInput({ normalizedQuery: 'теплый угол' }))).toBe('cancel');
    expect(resolvePendingChoose(createInput({ isSettled: false, normalizedQuery: 'теплый угол' }))).toBe('cancel');
  });
});
