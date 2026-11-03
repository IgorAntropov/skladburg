import type {
  GlobalSearchStatusValue,
  SearchGroupValue,
} from '../model/searchResultTypes';
import type { SearchQueryKindValue } from './classifySearchQuery';

export interface SearchStatusInputValue {
  groups: readonly SearchGroupValue[];
  hasSources: boolean;
  isSourcePending: boolean;
  queryKind: SearchQueryKindValue;
}

export const resolveSearchStatus = ({
  groups,
  hasSources,
  isSourcePending,
  queryKind,
}: SearchStatusInputValue): GlobalSearchStatusValue => {
  if (queryKind === 'idle') {
    return 'idle';
  }

  if (queryKind === 'too-short') {
    return 'too-short';
  }

  if (!hasSources) {
    return isSourcePending ? 'searching' : 'no-sources';
  }

  if (groups.some(group => group.options.length > 0)) {
    return 'ready';
  }

  if (groups.some(group => group.status === 'loading' || group.isStale)) {
    return 'searching';
  }

  return groups.some(group => group.status === 'error') ? 'ready' : 'empty';
};
