import type { AppAddressValue } from '@/shared/routing';

import {
  parseAppUrl,
  toAppUrl,
} from '@/shared/routing';

import { AIM_PREFIX } from './parseWarehouseScan';

export const readWarehouseQr = (raw: string, base: URL): AppAddressValue | undefined => {
  const text = raw.trim().replace(AIM_PREFIX, '');
  const address = parseAppUrl(text, base);
  if (address?.kind !== 'object' || toAppUrl(address, base) !== text) {
    return undefined;
  }
  switch (address.object.type) {
    case 'cell':
    case 'deal':
    case 'handling_unit':
      return address;
    default:
      return undefined;
  }
};
