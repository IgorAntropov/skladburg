import {
  describe,
  expect,
  it,
} from 'vitest';

import type { SearchGroupValue } from '../model/searchResultTypes';
import type { SearchStatusInputValue } from './resolveSearchStatus';

import { resolveSearchStatus } from './resolveSearchStatus';

const createGroup = (
  status: SearchGroupValue['status'],
  optionCount: number,
  isStale = false,
): SearchGroupValue => ({
  error: status === 'error' ? new Error('failed') : null,
  hasMore: false,
  id: 'cities',
  isStale,
  options: Array.from({ length: optionCount }, (_, index) => ({
    address: { kind: 'home' },
    detail: { kind: 'city' },
    detailMatches: [],
    groupId: 'cities',
    objectId: `city-${String(index)}`,
    title: 'Казань',
    titleMatches: [],
  })),
  retry: () => undefined,
  status,
});

const resolve = (override: Partial<SearchStatusInputValue>): ReturnType<typeof resolveSearchStatus> => resolveSearchStatus({
  groups: [],
  hasSources: true,
  isSourcePending: false,
  queryKind: 'active',
  ...override,
});

describe('resolveSearchStatus', () => {
  it('reports idle and too-short before anything else', () => {
    expect(resolve({ hasSources: false, queryKind: 'idle' })).toBe('idle');
    expect(resolve({ hasSources: false, queryKind: 'too-short' })).toBe('too-short');
  });

  it('reports no-sources when no group is available', () => {
    expect(resolve({ hasSources: false })).toBe('no-sources');
  });

  it('reports searching instead of no-sources while the profile is still loading', () => {
    expect(resolve({ hasSources: false, isSourcePending: true })).toBe('searching');
  });

  it('reports ready as soon as one group has options even when another still loads', () => {
    expect(resolve({ groups: [createGroup('ready', 1), createGroup('loading', 0)] })).toBe('ready');
  });

  it('reports searching while nothing is found and a group still loads', () => {
    expect(resolve({ groups: [createGroup('loading', 0)] })).toBe('searching');
  });

  it('reports ready while the stale rows of the previous query are shown', () => {
    expect(resolve({ groups: [createGroup('ready', 2, true)] })).toBe('ready');
  });

  it('does not report empty while a stale group is left without rows', () => {
    expect(resolve({ groups: [createGroup('ready', 0, true)] })).toBe('searching');
  });

  it('reports ready when only a failed group is left, so that its retry is shown', () => {
    expect(resolve({ groups: [createGroup('error', 0)] })).toBe('ready');
  });

  it('reports empty when everything answered and nothing was found', () => {
    expect(resolve({ groups: [] })).toBe('empty');
  });
});
