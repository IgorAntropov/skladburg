import type { MessageKey } from '@/shared/i18n';

import type {
  AppAddressValue,
  AppSectionValue,
} from './addressTypes';

import { OBJECT_HOME_SECTION } from './addressTypes';

export type PlacedAddressValue = Exclude<AppAddressValue, { kind: 'home' }>;

export const SECTION_TITLE_KEYS = {
  catalog: 'section.catalog.title',
  deals: 'section.deals.title',
  network: 'section.network.title',
  warehouse: 'section.warehouse.title',
} as const satisfies Record<AppSectionValue, MessageKey>;

export const getPlacedAddressSection = (address: PlacedAddressValue): AppSectionValue => {
  return address.kind === 'section' ? address.section : OBJECT_HOME_SECTION[address.object.type];
};

export const getAddressSection = (address: AppAddressValue): AppSectionValue | undefined => {
  return address.kind === 'home' ? undefined : getPlacedAddressSection(address);
};
