import type { LucideIcon } from 'lucide-react';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  ShoppingCart,
  Store,
  Truck,
} from 'lucide-react';

import type { MessageKey } from '@/shared/i18n';

export type KnownProfileKind = Exclude<ProfileKind, ProfileKind.UNSPECIFIED>;

export interface SideBadgeValue {
  className: string;
  Icon: LucideIcon;
  labelKey: MessageKey;
}

export const SIDE_BADGES = {
  [ProfileKind.CARRIER]: { className: 'text-side-label-carrier', Icon: Truck, labelKey: 'side.carrier' },
  [ProfileKind.CUSTOMER]: { className: 'text-side-label-customer', Icon: ShoppingCart, labelKey: 'side.customer' },
  [ProfileKind.SUPPLIER]: { className: 'text-side-label-supplier', Icon: Store, labelKey: 'side.supplier' },
} as const satisfies Record<KnownProfileKind, SideBadgeValue>;

export const isKnownProfileKind = (kind: ProfileKind): kind is KnownProfileKind => kind in SIDE_BADGES;
