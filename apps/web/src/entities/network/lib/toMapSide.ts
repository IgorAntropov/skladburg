import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';

import type { MapSideValue } from '../model/networkMapTypes';

export const toMapSide = (kind: ProfileKind): MapSideValue | undefined => {
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
