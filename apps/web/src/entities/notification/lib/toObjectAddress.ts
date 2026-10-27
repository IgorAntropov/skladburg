import type { ObjectLink } from '@skladburg/contracts/common/v1/object_link';

import { ObjectKind } from '@skladburg/contracts/common/v1/object_link';

import type {
  AppAddressValue,
  ObjectTypeValue,
} from '@/shared/routing';

const OBJECT_TYPE_BY_KIND: Readonly<Record<ObjectKind, ObjectTypeValue | undefined>> = {
  [ObjectKind.CELL]: 'cell',
  [ObjectKind.CITY]: 'city',
  [ObjectKind.DASHBOARD]: 'dashboard',
  [ObjectKind.DEAL]: 'deal',
  [ObjectKind.DOCUMENT]: 'document',
  [ObjectKind.HANDLING_UNIT]: 'handling_unit',
  [ObjectKind.ORGANIZATION]: 'organization',
  [ObjectKind.SITE]: 'site',
  [ObjectKind.TRIP]: 'trip',
  [ObjectKind.UNSPECIFIED]: undefined,
  [ObjectKind.VEHICLE]: 'vehicle',
  [ObjectKind.WAREHOUSE]: 'warehouse',
};

export const toObjectAddress = (link: ObjectLink): AppAddressValue | undefined => {
  const { target } = link;

  if (target === undefined) {
    return undefined;
  }

  const type = OBJECT_TYPE_BY_KIND[target.kind];

  return type === undefined ? undefined : { kind: 'object', object: { id: target.id, type } };
};
