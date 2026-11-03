import {
  describe,
  expect,
  it,
} from 'vitest';

import type { SearchListStateValue } from './searchListReducer';

import {
  INITIAL_SEARCH_LIST_STATE,
  resolveActiveOptionId,
  searchListReducer,
} from './searchListReducer';

const QUERY = 'теплый';
const IDS = ['org-1', 'site-1', 'site-2', 'listing-1'] as const;

const stateOf = (activeId: string | undefined, normalizedQuery: string = QUERY): SearchListStateValue => ({
  activeId,
  normalizedQuery,
});

describe('resolveActiveOptionId', () => {
  it('is the first option when nothing was chosen yet', () => {
    expect(resolveActiveOptionId(INITIAL_SEARCH_LIST_STATE, QUERY, IDS)).toBe('org-1');
  });

  it('keeps the chosen option while the query and the option stay', () => {
    expect(resolveActiveOptionId(stateOf('site-2'), QUERY, IDS)).toBe('site-2');
  });

  it('keeps the chosen option when more options arrive below it', () => {
    expect(resolveActiveOptionId(stateOf('org-1'), QUERY, [...IDS, 'listing-2'])).toBe('org-1');
  });

  it('goes back to the first option for a new query', () => {
    expect(resolveActiveOptionId(stateOf('site-2'), 'теплый у', IDS)).toBe('org-1');
  });

  it('goes back to the first option when the chosen one is gone', () => {
    expect(resolveActiveOptionId(stateOf('site-2'), QUERY, ['org-1', 'listing-1'])).toBe('org-1');
  });

  it('is undefined for an empty list', () => {
    expect(resolveActiveOptionId(stateOf('site-2'), QUERY, [])).toBeUndefined();
  });
});

describe('searchListReducer', () => {
  describe('moved', () => {
    it('goes down through the groups one option at a time', () => {
      let state = INITIAL_SEARCH_LIST_STATE;
      const seen: (string | undefined)[] = [];

      for (let index = 0; index < 3; index += 1) {
        state = searchListReducer(state, { kind: 'moved', normalizedQuery: QUERY, optionIds: IDS, step: 1 });
        seen.push(state.activeId);
      }

      expect(seen).toEqual(['site-1', 'site-2', 'listing-1']);
    });

    it('goes up and wraps from the first option to the last', () => {
      const first = searchListReducer(stateOf('site-1'), { kind: 'moved', normalizedQuery: QUERY, optionIds: IDS, step: -1 });
      const wrapped = searchListReducer(first, { kind: 'moved', normalizedQuery: QUERY, optionIds: IDS, step: -1 });

      expect(first.activeId).toBe('org-1');
      expect(wrapped.activeId).toBe('listing-1');
    });

    it('wraps from the last option to the first going down', () => {
      const next = searchListReducer(stateOf('listing-1'), { kind: 'moved', normalizedQuery: QUERY, optionIds: IDS, step: 1 });

      expect(next.activeId).toBe('org-1');
    });

    it('starts from the first option for a new query', () => {
      const next = searchListReducer(stateOf('site-2', 'теплый у'), {
        kind: 'moved',
        normalizedQuery: QUERY,
        optionIds: IDS,
        step: 1,
      });

      expect(next).toEqual(stateOf('site-1'));
    });

    it('treats a vanished active option as the first one', () => {
      const next = searchListReducer(stateOf('site-2'), {
        kind: 'moved',
        normalizedQuery: QUERY,
        optionIds: ['org-1', 'listing-1'],
        step: 1,
      });

      expect(next.activeId).toBe('listing-1');
    });

    it('stays as it is for an empty list', () => {
      const state = stateOf(undefined);

      expect(searchListReducer(state, { kind: 'moved', normalizedQuery: QUERY, optionIds: [], step: 1 })).toBe(state);
    });

    it('moves around a list of one option', () => {
      const state = searchListReducer(INITIAL_SEARCH_LIST_STATE, {
        kind: 'moved',
        normalizedQuery: QUERY,
        optionIds: ['only'],
        step: -1,
      });

      expect(state.activeId).toBe('only');
      expect(searchListReducer(state, { kind: 'moved', normalizedQuery: QUERY, optionIds: ['only'], step: 1 }).activeId).toBe('only');
    });
  });

  describe('pointer-activated', () => {
    it('makes the row under the pointer active', () => {
      expect(searchListReducer(stateOf('org-1'), { kind: 'pointer-activated', normalizedQuery: QUERY, optionId: 'site-2' }))
        .toEqual(stateOf('site-2'));
    });

    it('returns the same state when the row is already active', () => {
      const state = stateOf('site-2');

      expect(searchListReducer(state, { kind: 'pointer-activated', normalizedQuery: QUERY, optionId: 'site-2' })).toBe(state);
    });
  });
});
