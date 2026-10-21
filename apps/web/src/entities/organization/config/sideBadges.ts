import type { LucideIcon } from 'lucide-react';

import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import {
  ShoppingCart,
  Store,
  Truck,
} from 'lucide-react';

import type { MessageKey } from '@/shared/i18n';

export type OrganizationSideValue = 'carrier' | 'customer' | 'supplier';

export interface SideBadgeValue {
  className: string;
  Icon: LucideIcon;
  labelKey: MessageKey;
}

export const SIDE_BADGES = {
  carrier: { className: 'text-side-label-carrier', Icon: Truck, labelKey: 'side.carrier' },
  customer: { className: 'text-side-label-customer', Icon: ShoppingCart, labelKey: 'side.customer' },
  supplier: { className: 'text-side-label-supplier', Icon: Store, labelKey: 'side.supplier' },
} as const satisfies Record<OrganizationSideValue, SideBadgeValue>;

export const toOrganizationSide = (kind: ProfileKind): OrganizationSideValue | undefined => {
  switch (kind) {
    case ProfileKind.CARRIER:
      return 'carrier';
    case ProfileKind.CUSTOMER:
      return 'customer';
    case ProfileKind.SUPPLIER:
      return 'supplier';
    default:
      return undefined;
  }
};
