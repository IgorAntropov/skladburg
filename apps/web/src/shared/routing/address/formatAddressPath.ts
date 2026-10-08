import type { AppAddressValue } from './addressTypes';

import { OBJECT_PATH_SEGMENTS } from './addressTypes';

export const formatAddressPath = (address: AppAddressValue): string => {
  switch (address.kind) {
    case 'home':
      return '/';
    case 'object':
      return `/${OBJECT_PATH_SEGMENTS[address.object.type]}/${address.object.id}`;
    case 'section':
      return `/${address.section}`;
  }
};
