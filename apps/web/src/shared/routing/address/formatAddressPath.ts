import type { AppAddressValue } from './addressTypes';

import { OBJECT_ROUTES } from './addressTypes';

export const formatAddressPath = (address: AppAddressValue): string => {
  switch (address.kind) {
    case 'home':
      return '/';
    case 'object':
      return `/${OBJECT_ROUTES[address.object.type].segment}/${address.object.id}`;
    case 'section':
      return `/${address.section}`;
  }
};
