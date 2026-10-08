import type { MessageKey } from '@/shared/i18n';
import type {
  AppAddressValue,
  AppSectionValue,
} from '@/shared/routing';

import { OBJECT_HOME_SECTION } from '@/shared/routing';

export type PlacedAddressValue = Exclude<AppAddressValue, { kind: 'home' }>;

export const DEFAULT_SECTION: AppSectionValue = 'network';

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
