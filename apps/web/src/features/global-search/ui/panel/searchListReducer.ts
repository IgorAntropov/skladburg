export type SearchListActionValue
  = | { kind: 'moved'; normalizedQuery: string; optionIds: readonly string[]; step: -1 | 1 }
    | { kind: 'pointer-activated'; normalizedQuery: string; optionId: string };

export interface SearchListStateValue {
  activeId: string | undefined;
  normalizedQuery: string;
}

export const INITIAL_SEARCH_LIST_STATE: SearchListStateValue = {
  activeId: undefined,
  normalizedQuery: '',
};

export const resolveActiveOptionId = (
  state: SearchListStateValue,
  normalizedQuery: string,
  optionIds: readonly string[],
): string | undefined => {
  const { activeId } = state;
  const isActiveKept = activeId !== undefined
    && state.normalizedQuery === normalizedQuery
    && optionIds.includes(activeId);

  return isActiveKept ? activeId : optionIds[0];
};

const resolveMovedIndex = (currentIndex: number, step: -1 | 1, count: number): number => {
  if (currentIndex === -1) {
    return step === 1 ? 0 : count - 1;
  }

  return (currentIndex + step + count) % count;
};

export const searchListReducer = (
  state: SearchListStateValue,
  action: SearchListActionValue,
): SearchListStateValue => {
  switch (action.kind) {
    case 'moved': {
      const { normalizedQuery, optionIds, step } = action;

      if (optionIds.length === 0) {
        return state;
      }

      const currentId = resolveActiveOptionId(state, normalizedQuery, optionIds);
      const nextId = optionIds[resolveMovedIndex(currentId === undefined ? -1 : optionIds.indexOf(currentId), step, optionIds.length)];

      return { activeId: nextId, normalizedQuery };
    }
    case 'pointer-activated': {
      const isUnchanged = state.activeId === action.optionId && state.normalizedQuery === action.normalizedQuery;

      return isUnchanged ? state : { activeId: action.optionId, normalizedQuery: action.normalizedQuery };
    }
  }
};
