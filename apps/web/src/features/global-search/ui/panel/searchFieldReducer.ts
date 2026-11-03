export type SearchEnterOutcomeValue = 'choose' | 'none' | 'wait';

export type SearchFieldActionValue
  = | { isPanelLoaded: boolean; kind: 'enter-pressed'; query: string }
    | { kind: 'active-option-changed'; optionDomId: string | undefined }
    | { kind: 'arrow-pressed' }
    | { kind: 'dismissed' }
    | { kind: 'focused' }
    | { kind: 'pending-choose-settled' }
    | { kind: 'query-changed' };

export interface SearchFieldStateValue {
  activeOptionDomId: string | undefined;
  isPanelOpen: boolean;
  pendingChooseQuery: string | undefined;
}

export const INITIAL_SEARCH_FIELD_STATE: SearchFieldStateValue = {
  activeOptionDomId: undefined,
  isPanelOpen: false,
  pendingChooseQuery: undefined,
};

export const getEnterOutcome = (
  state: SearchFieldStateValue,
  query: string,
  isPanelLoaded: boolean,
): SearchEnterOutcomeValue => {
  if (query.trim() === '') {
    return 'none';
  }

  const isActiveOptionChoosable = isPanelLoaded && state.isPanelOpen && state.activeOptionDomId !== undefined;

  return isActiveOptionChoosable ? 'choose' : 'wait';
};

export const searchFieldReducer = (
  state: SearchFieldStateValue,
  action: SearchFieldActionValue,
): SearchFieldStateValue => {
  switch (action.kind) {
    case 'active-option-changed':
      return state.isPanelOpen ? { ...state, activeOptionDomId: action.optionDomId } : state;
    case 'arrow-pressed':
    case 'focused':
      return state.isPanelOpen ? state : { ...state, isPanelOpen: true };
    case 'dismissed':
      return state.isPanelOpen ? INITIAL_SEARCH_FIELD_STATE : state;
    case 'enter-pressed':
      return getEnterOutcome(state, action.query, action.isPanelLoaded) === 'wait'
        ? { ...state, isPanelOpen: true, pendingChooseQuery: action.query }
        : state;
    case 'pending-choose-settled':
      return state.pendingChooseQuery === undefined ? state : { ...state, pendingChooseQuery: undefined };
    case 'query-changed':
      return { activeOptionDomId: undefined, isPanelOpen: true, pendingChooseQuery: undefined };
  }
};
