import type { User } from '@skladburg/contracts/access/v1/access';
import type { ObjectLink } from '@skladburg/contracts/common/v1/object_link';
import type { DigestItem } from '@skladburg/contracts/notification/v1/notification';

import { create } from '@bufbuild/protobuf';
import { PermissionCode } from '@skladburg/contracts/access/v1/permission';
import {
  ObjectKind,
  ObjectLinkSchema,
} from '@skladburg/contracts/common/v1/object_link';
import {
  DigestItemKind,
  DigestItemSchema,
} from '@skladburg/contracts/notification/v1/notification';
import { ProfileKind } from '@skladburg/contracts/organization/v1/organization';
import { getPermissionName } from '@skladburg/contracts/runtime';

import type {
  EffectivePermissionValue,
  PermissionScopeValue,
} from '../../access/index';
import type { IStateReader } from '../../state/index';

import {
  listVisibleOrganizationShowcases,
  listVisibleWarehouses,
  MIN_SHOWCASE_VERIFICATION_LEVEL,
  resolveMapSiteProfileKind,
} from '../../visibility/index';
import { countUnreadNotifications } from './notificationRecords';

export const MAX_VERIFICATION_LEVEL = 4;

const WAREHOUSE_VIEW_PERMISSION = getPermissionName(PermissionCode.WAREHOUSE_VIEW);
const NETWORK_VIEW_PERMISSION = getPermissionName(PermissionCode.NETWORK_VIEW);
const ORGANIZATION_PROFILE_PERMISSIONS: readonly string[] = [
  getPermissionName(PermissionCode.ORGANIZATION_EDIT),
  getPermissionName(PermissionCode.ORGANIZATION_MANAGE),
];

export interface DigestCallerValue {
  organizationId: string;
  permissions: readonly EffectivePermissionValue[];
  user: User;
}

const PARTNER_SIDE_BY_PROFILE: Readonly<Partial<Record<ProfileKind, ProfileKind>>> = {
  [ProfileKind.CUSTOMER]: ProfileKind.SUPPLIER,
  [ProfileKind.SUPPLIER]: ProfileKind.CUSTOMER,
};

const createSiteLink = (warehouseId: string): ObjectLink =>
  create(ObjectLinkSchema, { target: { id: warehouseId, kind: ObjectKind.SITE } });

const createOrganizationLink = (organizationId: string): ObjectLink =>
  create(ObjectLinkSchema, { target: { id: organizationId, kind: ObjectKind.ORGANIZATION } });

const findScope = (caller: DigestCallerValue, permissionName: string): PermissionScopeValue | undefined =>
  caller.permissions.find(candidate => candidate.permission === permissionName);

const buildUnreadItem = (reader: IStateReader, caller: DigestCallerValue): DigestItem[] => {
  const count = countUnreadNotifications(reader, caller.user.id, caller.organizationId);

  return count === 0 ? [] : [create(DigestItemSchema, { count, kind: DigestItemKind.UNREAD_NOTIFICATIONS })];
};

const buildWarehousesItem = (reader: IStateReader, caller: DigestCallerValue): DigestItem[] => {
  const scope = findScope(caller, WAREHOUSE_VIEW_PERMISSION);

  if (scope === undefined) {
    return [];
  }

  const warehouses = listVisibleWarehouses(reader, caller.organizationId, scope);
  const [first] = warehouses;

  return first === undefined
    ? []
    : [create(DigestItemSchema, { count: warehouses.length, kind: DigestItemKind.OWN_WAREHOUSES, link: createSiteLink(first.id) })];
};

const buildPartnersItem = (reader: IStateReader, caller: DigestCallerValue): DigestItem[] => {
  if (findScope(caller, NETWORK_VIEW_PERMISSION)?.isOrganizationWide !== true) {
    return [];
  }

  const viewer = reader.get('organizations', caller.organizationId);
  const partnerSide = viewer === undefined
    ? ProfileKind.UNSPECIFIED
    : PARTNER_SIDE_BY_PROFILE[resolveMapSiteProfileKind(viewer)] ?? ProfileKind.UNSPECIFIED;
  const count = listVisibleOrganizationShowcases(reader, caller.organizationId, {
    minVerificationLevel: MIN_SHOWCASE_VERIFICATION_LEVEL,
    profileKind: partnerSide,
    sphereId: '',
  }).filter(showcase => showcase.id !== caller.organizationId).length;

  return count === 0 ? [] : [create(DigestItemSchema, { count, kind: DigestItemKind.VERIFIED_PARTNERS, partnerSide })];
};

const buildNextLevelItem = (reader: IStateReader, caller: DigestCallerValue): DigestItem[] => {
  const canEditProfile = ORGANIZATION_PROFILE_PERMISSIONS.some(permissionName => findScope(caller, permissionName) !== undefined);
  const organization = reader.get('organizations', caller.organizationId);

  if (!canEditProfile || organization === undefined || organization.profiles.length === 0) {
    return [];
  }

  const currentLevel = Math.max(...organization.profiles.map(profile => profile.verificationLevel));

  return currentLevel >= MAX_VERIFICATION_LEVEL
    ? []
    : [create(DigestItemSchema, {
        kind: DigestItemKind.VERIFICATION_NEXT_LEVEL,
        link: createOrganizationLink(organization.id),
        nextLevel: currentLevel + 1,
      })];
};

export const buildDigest = (reader: IStateReader, caller: DigestCallerValue): DigestItem[] => [
  ...buildUnreadItem(reader, caller),
  ...buildWarehousesItem(reader, caller),
  ...buildPartnersItem(reader, caller),
  ...buildNextLevelItem(reader, caller),
];
