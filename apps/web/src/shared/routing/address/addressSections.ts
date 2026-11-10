import type { MessageKey } from '@/shared/i18n';

import type {
  AppAddressValue,
  AppSectionValue,
} from './addressTypes';

import { OBJECT_ROUTES } from './addressTypes';

export type PlacedAddressValue = Exclude<AppAddressValue, { kind: 'home' }>;

type SectionTitleKey = Extract<MessageKey, `section.${AppSectionValue}.title`>;

export const getSectionTitleKey = (section: AppSectionValue): SectionTitleKey => `section.${section}.title`;

export const getPlacedAddressSection = (address: PlacedAddressValue): AppSectionValue => {
  return address.kind === 'section' ? address.section : OBJECT_ROUTES[address.object.type].section;
};

export const getAddressSection = (address: AppAddressValue): AppSectionValue | undefined => {
  return address.kind === 'home' ? undefined : getPlacedAddressSection(address);
};
