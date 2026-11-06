import { create } from '@bufbuild/protobuf';
import {
  type EffectivePermission,
  EffectivePermissionSchema,
  type Membership,
} from '@skladburg/contracts/access/v1/access';
import {
  findPermissionCode,
  getPermissionTraits,
} from '@skladburg/contracts/runtime';

import type { IStateReader } from '../state/index';
import type { PermissionGrantValue } from './permissionGrants';
import type { EffectivePermissionValue } from './permissionScope';

import { compareIds } from '../state/index';
import { resolvePermissionGrants } from './permissionGrants';

interface MutableScopeValue {
  isOrganizationWide: boolean;
  warehouseIds: Set<string>;
}

export const summarizePermissionGrants = (grants: readonly PermissionGrantValue[]): EffectivePermissionValue[] => {
  const scopes = new Map<string, MutableScopeValue>();

  for (const grant of grants) {
    const scope = scopes.get(grant.permission) ?? { isOrganizationWide: false, warehouseIds: new Set<string>() };

    scope.isOrganizationWide = scope.isOrganizationWide || grant.isOrganizationWide;

    for (const warehouseId of grant.warehouseIds) {
      scope.warehouseIds.add(warehouseId);
    }

    scopes.set(grant.permission, scope);
  }

  return [...scopes]
    .sort(([current], [next]) => compareIds(current, next))
    .map(([permission, scope]) => ({
      isOrganizationWide: scope.isOrganizationWide,
      permission,
      warehouseIds: scope.isOrganizationWide ? [] : [...scope.warehouseIds].sort(compareIds),
    }));
};

export const resolveEffectivePermissions = (read: IStateReader, membership: Membership): EffectivePermissionValue[] =>
  summarizePermissionGrants(resolvePermissionGrants(read, membership));

const hasApplicableLimit = (grant: PermissionGrantValue): boolean => {
  const code = findPermissionCode(grant.permission);

  return code !== undefined && getPermissionTraits(code).isLimitApplicable;
};

const isGrantCovered = (current: PermissionGrantValue, covering: PermissionGrantValue): boolean => {
  const isScopeCovered = covering.isOrganizationWide
    || (!current.isOrganizationWide && current.warehouseIds.every(warehouseId => covering.warehouseIds.includes(warehouseId)));

  if (current.permission !== covering.permission || !isScopeCovered) {
    return false;
  }

  return covering.amountLimit === undefined
    || (current.amountLimit?.currencyCode === covering.amountLimit.currencyCode
      && current.amountLimit.amountMinor <= covering.amountLimit.amountMinor);
};

const compareSessionPermissions = (current: EffectivePermission, next: EffectivePermission): number => {
  const permissionOrder = compareIds(current.permission, next.permission);

  if (permissionOrder !== 0) {
    return permissionOrder;
  }

  if (current.isOrganizationWide !== next.isOrganizationWide) {
    return current.isOrganizationWide ? -1 : 1;
  }

  return compareIds(current.warehouseIds.join(','), next.warehouseIds.join(','))
    || compareIds(current.amountLimit?.currencyCode ?? '', next.amountLimit?.currencyCode ?? '');
};

export const projectSessionPermissions = (grants: readonly PermissionGrantValue[]): EffectivePermission[] => {
  const limited = grants.filter(hasApplicableLimit).map(grant => ({
    ...grant,
    warehouseIds: grant.isOrganizationWide ? [] : [...new Set(grant.warehouseIds)].sort(compareIds),
  }));
  const effectiveLimited = limited.filter((current, currentIndex) => !limited.some((covering, coveringIndex) =>
    coveringIndex !== currentIndex
    && isGrantCovered(current, covering)
    && (coveringIndex < currentIndex || !isGrantCovered(covering, current))));
  const effectiveUnlimited = summarizePermissionGrants(grants.filter(grant => !hasApplicableLimit(grant)));

  return [
    ...effectiveUnlimited.map(permission => create(EffectivePermissionSchema, {
      ...permission,
      warehouseIds: [...permission.warehouseIds],
    })),
    ...effectiveLimited.map(permission => create(EffectivePermissionSchema, permission)),
  ].sort(compareSessionPermissions);
};
