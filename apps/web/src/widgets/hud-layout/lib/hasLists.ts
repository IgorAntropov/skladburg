import type { ReactNode } from 'react';

import type { TabsItemValue } from '@/shared/ui';

import { hasSlot } from './hasSlot';

interface ListsSlotsValue {
  listsHeader?: ReactNode | undefined;
  listTabs?: readonly TabsItemValue[] | undefined;
}

export const hasListTabs = (listTabs: readonly TabsItemValue[] | undefined): listTabs is readonly TabsItemValue[] => {
  return listTabs !== undefined && listTabs.length > 0;
};

export const hasLists = ({ listsHeader, listTabs }: ListsSlotsValue): boolean => {
  return hasListTabs(listTabs) || hasSlot(listsHeader);
};
