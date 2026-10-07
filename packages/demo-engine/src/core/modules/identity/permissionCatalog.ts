import type { DescService } from '@bufbuild/protobuf';

import { create } from '@bufbuild/protobuf';
import {
  type Permission,
  PermissionAction,
  PermissionSchema,
} from '@skladburg/contracts/access/v1/access';
import {
  getMethodAccess,
  listPermissionNames,
} from '@skladburg/contracts/runtime';

const PERMISSION_NAME_SEPARATOR = '_';

const ACTION_BY_NAME: ReadonlyMap<string, PermissionAction> = new Map(
  Object.values(PermissionAction)
    .filter((value): value is PermissionAction => typeof value === 'number' && value !== PermissionAction.UNSPECIFIED)
    .map(action => [PermissionAction[action].toLowerCase(), action]),
);

interface PermissionFlagsValue {
  isLimitApplicable: boolean;
  isScopeApplicable: boolean;
}

const collectPermissionFlags = (services: readonly DescService[]): Map<string, PermissionFlagsValue> => {
  const flags = new Map<string, PermissionFlagsValue>();

  for (const method of services.flatMap(service => service.methods)) {
    const requirement = getMethodAccess(method)?.requirement;

    if (requirement?.case === 'permission') {
      const current = flags.get(requirement.value.name) ?? { isLimitApplicable: false, isScopeApplicable: false };

      flags.set(requirement.value.name, {
        isLimitApplicable: current.isLimitApplicable || requirement.value.limitField !== '',
        isScopeApplicable: current.isScopeApplicable || requirement.value.scopeField !== '',
      });
    }
  }

  return flags;
};

export const buildPermissionCatalog = (services: readonly DescService[]): Permission[] => {
  const flags = collectPermissionFlags(services);

  return listPermissionNames(services).map((name) => {
    const separatorIndex = name.lastIndexOf(PERMISSION_NAME_SEPARATOR);

    return create(PermissionSchema, {
      action: ACTION_BY_NAME.get(name.slice(separatorIndex + 1)) ?? PermissionAction.UNSPECIFIED,
      feature: name.slice(0, separatorIndex),
      isLimitApplicable: flags.get(name)?.isLimitApplicable ?? false,
      isScopeApplicable: flags.get(name)?.isScopeApplicable ?? false,
      name,
    });
  });
};
