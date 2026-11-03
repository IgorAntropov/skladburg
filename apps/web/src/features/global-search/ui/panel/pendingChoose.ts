import { normalizeSearchText } from '@skladburg/contracts/runtime';

import type { GlobalSearchValue } from '../../model/searchResultTypes';

export interface PendingChooseInputValue {
  hasOptions: boolean;
  isSettled: boolean;
  normalizedQuery: string;
  pendingChooseQuery: string | undefined;
}

export type PendingChooseOutcomeValue = 'cancel' | 'choose' | 'none' | 'wait';

export const isSearchSettled = ({ groups, status }: Pick<GlobalSearchValue, 'groups' | 'status'>): boolean => (
  status !== 'searching' && !groups.some(group => group.status === 'loading' || group.isStale)
);

export const resolvePendingChoose = ({
  hasOptions,
  isSettled,
  normalizedQuery,
  pendingChooseQuery,
}: PendingChooseInputValue): PendingChooseOutcomeValue => {
  if (pendingChooseQuery === undefined) {
    return 'none';
  }

  if (normalizeSearchText(pendingChooseQuery) !== normalizedQuery) {
    return 'cancel';
  }

  if (!isSettled) {
    return 'wait';
  }

  return hasOptions ? 'choose' : 'cancel';
};
