import {
  describe,
  expect,
  it,
} from 'vitest';

import type {
  SearchFieldActionValue,
  SearchFieldStateValue,
} from './searchFieldReducer';

import {
  getEnterOutcome,
  INITIAL_SEARCH_FIELD_STATE,
  searchFieldReducer,
} from './searchFieldReducer';

const OPTION_ID = ':r1:-own-listings-b0000001';
const QUERY = 'теплый';

const withState = (patch: Partial<SearchFieldStateValue>): SearchFieldStateValue => ({
  ...INITIAL_SEARCH_FIELD_STATE,
  ...patch,
});

const reduce = (state: SearchFieldStateValue, ...actions: SearchFieldActionValue[]): SearchFieldStateValue => {
  return actions.reduce(searchFieldReducer, state);
};

describe('searchFieldReducer', () => {
  describe('opening', () => {
    it('opens the panel on focus', () => {
      expect(reduce(INITIAL_SEARCH_FIELD_STATE, { kind: 'focused' }).isPanelOpen).toBe(true);
    });

    it('opens the panel on typing', () => {
      const state = reduce(INITIAL_SEARCH_FIELD_STATE, { kind: 'query-changed' });

      expect(state).toEqual(withState({ isPanelOpen: true }));
    });

    it('opens the closed panel on an arrow key and leaves an open one as it is', () => {
      const open = withState({ activeOptionDomId: OPTION_ID, isPanelOpen: true });

      expect(reduce(INITIAL_SEARCH_FIELD_STATE, { kind: 'arrow-pressed' })).toEqual(withState({ isPanelOpen: true }));
      expect(reduce(open, { kind: 'arrow-pressed' })).toBe(open);
    });

    it('returns the same state when focus arrives at the open panel', () => {
      const open = withState({ isPanelOpen: true });

      expect(reduce(open, { kind: 'focused' })).toBe(open);
    });
  });

  describe('active option', () => {
    it('takes the active option of the open panel', () => {
      const state = reduce(withState({ isPanelOpen: true }), { kind: 'active-option-changed', optionDomId: OPTION_ID });

      expect(state.activeOptionDomId).toBe(OPTION_ID);
    });

    it('ignores the active option of a panel that is closed', () => {
      expect(
        reduce(INITIAL_SEARCH_FIELD_STATE, { kind: 'active-option-changed', optionDomId: OPTION_ID }),
      ).toBe(INITIAL_SEARCH_FIELD_STATE);
    });

    it('forgets the active option when the text changes', () => {
      const state = reduce(
        withState({ activeOptionDomId: OPTION_ID, isPanelOpen: true }),
        { kind: 'query-changed' },
      );

      expect(state.activeOptionDomId).toBeUndefined();
    });

    it('forgets the active option when the panel closes', () => {
      const state = reduce(
        withState({ activeOptionDomId: OPTION_ID, isPanelOpen: true }),
        { kind: 'dismissed' },
      );

      expect(state.activeOptionDomId).toBeUndefined();
    });
  });

  describe('enter', () => {
    it('asks the panel to choose when it is loaded and has an active option', () => {
      const state = withState({ activeOptionDomId: OPTION_ID, isPanelOpen: true });

      expect(getEnterOutcome(state, QUERY, true)).toBe('choose');
      expect(reduce(state, { isPanelLoaded: true, kind: 'enter-pressed', query: QUERY })).toBe(state);
    });

    it('waits for the answer of the panel that has no active option yet', () => {
      const state = withState({ isPanelOpen: true });

      expect(getEnterOutcome(state, QUERY, true)).toBe('wait');
      expect(
        reduce(state, { isPanelLoaded: true, kind: 'enter-pressed', query: QUERY }).pendingChooseQuery,
      ).toBe(QUERY);
    });

    it('waits when the panel is closed and opens it', () => {
      const state = reduce(
        INITIAL_SEARCH_FIELD_STATE,
        { isPanelLoaded: false, kind: 'enter-pressed', query: '4607001234567' },
      );

      expect(state.pendingChooseQuery).toBe('4607001234567');
      expect(state.isPanelOpen).toBe(true);
    });

    it('does not trust an active option of a panel that is not loaded', () => {
      const state = withState({ activeOptionDomId: OPTION_ID, isPanelOpen: true });

      expect(getEnterOutcome(state, QUERY, false)).toBe('wait');
    });

    it('does nothing on an empty or blank query', () => {
      const state = withState({ isPanelOpen: true });

      expect(getEnterOutcome(state, '', true)).toBe('none');
      expect(reduce(state, { isPanelLoaded: true, kind: 'enter-pressed', query: '' })).toBe(state);
      expect(reduce(state, { isPanelLoaded: true, kind: 'enter-pressed', query: '   ' })).toBe(state);
    });

    it('cancels the wait when the text changes', () => {
      const state = reduce(
        withState({ isPanelOpen: true, pendingChooseQuery: QUERY }),
        { kind: 'query-changed' },
      );

      expect(state.pendingChooseQuery).toBeUndefined();
    });

    it('drops the wait when the panel settles it', () => {
      const state = reduce(
        withState({ isPanelOpen: true, pendingChooseQuery: QUERY }),
        { kind: 'pending-choose-settled' },
      );

      expect(state).toEqual(withState({ isPanelOpen: true }));
    });

    it('returns the same state when there is nothing to settle', () => {
      const state = withState({ isPanelOpen: true });

      expect(reduce(state, { kind: 'pending-choose-settled' })).toBe(state);
    });
  });

  describe('dismiss', () => {
    it('closes the open panel and drops the active option and the wait', () => {
      const state = reduce(
        withState({ activeOptionDomId: OPTION_ID, isPanelOpen: true, pendingChooseQuery: QUERY }),
        { kind: 'dismissed' },
      );

      expect(state).toEqual(INITIAL_SEARCH_FIELD_STATE);
    });

    it('returns the same state when a closed panel is dismissed', () => {
      expect(reduce(INITIAL_SEARCH_FIELD_STATE, { kind: 'dismissed' })).toBe(INITIAL_SEARCH_FIELD_STATE);
    });
  });
});
